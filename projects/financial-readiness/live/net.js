/* net.js: the live room between the slide deck (host) and cadets' phones, the same way Practicum Adventure
 * does it (practicum-adventure/net.js): the deck opens a PeerJS room and phones connect straight to it over
 * WebRTC. No server of our own and no accounts; the free PeerJS broker only introduces the two ends.
 * Add ?local=1 to both pages (same browser) to use a BroadcastChannel instead, for testing without internet.
 *
 * FRNet.host(code, {onMsg(cid, msg), onOpen(), onStatus(s)})  -> {send(cid, msg), all(msg), status}
 * FRNet.join(code, cid, {onMsg(msg), onStatus(s)})             -> {send(msg)}
 * status: 'connecting', 'live', 'error', 'reconnecting'
 * Code organized with help from Claude (Anthropic), Nov 2026.
 */
(function (root) {
  'use strict';
  const PREFIX = 'afas3410-fr-';
  const local = () => /[?&]local=1/.test(location.search) || !root.Peer;

  function host(code, h) {
    const api = { status: 'connecting', conns: {} };
    const st = (s) => { api.status = s; h.onStatus && h.onStatus(s); };
    if (local()) {
      const bc = new BroadcastChannel('fr-room-' + code);
      bc.onmessage = (e) => { const d = e.data; if (d && d.to === 'host' && d.cid) h.onMsg(d.cid, d.m); };
      api.send = (cid, m) => bc.postMessage({ to: cid, m });
      api.all = (m) => bc.postMessage({ to: '*', m });
      setTimeout(() => st('live'), 0);
      return api;
    }
    let peer;
    const start = () => {
      st('connecting');
      peer = new root.Peer(PREFIX + code.toLowerCase(), { debug: 0 });
      peer.on('open', () => { st('live'); h.onOpen && h.onOpen(); });
      peer.on('connection', (conn) => {
        conn.on('data', (d) => { if (d && d.cid) { api.conns[d.cid] = conn; h.onMsg(String(d.cid).slice(0, 40), d.m); } });
        conn.on('close', () => { for (const k in api.conns) if (api.conns[k] === conn) delete api.conns[k]; });
      });
      peer.on('disconnected', () => { st('reconnecting'); try { peer.reconnect(); } catch (e) {} });
      peer.on('error', (e) => {
        if (e.type === 'unavailable-id') { st('reconnecting'); try { peer.destroy(); } catch (x) {} setTimeout(start, 4000); }
        else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) st('error');
      });
    };
    start();
    api.send = (cid, m) => { const c = api.conns[cid]; if (c && c.open) try { c.send({ m }); } catch (e) {} };
    api.all = (m) => { for (const k in api.conns) api.send(k, m); };
    return api;
  }

  function join(code, cid, h) {
    const api = {};
    const st = (s) => h.onStatus && h.onStatus(s);
    if (local()) {
      const bc = new BroadcastChannel('fr-room-' + code);
      bc.onmessage = (e) => { const d = e.data; if (d && (d.to === cid || d.to === '*') && d.m) h.onMsg(d.m); };
      api.send = (m) => bc.postMessage({ to: 'host', cid, m });
      setTimeout(() => st('live'), 0);
      return api;
    }
    let peer = null, conn = null, timer = 0;
    const connect = () => {
      clearTimeout(timer);
      st('connecting');
      if (!peer || peer.destroyed) {
        peer = new root.Peer({ debug: 0 });
        peer.on('open', open);
        peer.on('error', () => { st('error'); timer = setTimeout(connect, 3000); });
        peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
      } else open();
    };
    const open = () => {
      conn = peer.connect(PREFIX + code.toLowerCase(), { reliable: true });
      conn.on('open', () => { st('live'); h.onOpen && h.onOpen(); });
      conn.on('data', (d) => { if (d && d.m) h.onMsg(d.m); });
      conn.on('close', () => { st('reconnecting'); timer = setTimeout(connect, 2000); });
    };
    connect();
    api.send = (m) => { if (conn && conn.open) try { conn.send({ cid, m }); } catch (e) {} };
    return api;
  }
  root.FRNet = { host, join, local };
})(this);
