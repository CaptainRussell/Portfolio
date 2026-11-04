/* engine.js: keyframe timeline and SVG renderer for the lessons.
 *
 * Carried over from the animation engine of my CPRE 5990 defense slides
 * (projects/daniels-cipher/slides/), with the cyber palette and two new
 * object kinds for networking scenes (node and packet).
 *
 * A Scene is a set of objects plus a list of steps. A step is one click of
 * Next; it plays one or more beats in order. A beat is a full snapshot of
 * every object's properties plus a duration, and the player eases from the
 * previous snapshot to the beat's snapshot. Every frame is a pure function of
 * (step, time), so any step can be replayed or jumped to.
 *
 * Building a scene:
 *   const S = new Anim.Scene('id');
 *   S.add('me', 'node', {icon:'laptop', label:'You'}, {x:200, y:450, o:0});
 *   S.step({head:'Meet the sender', body:'One short sentence.'})
 *    .beat(0.8, (s) => { s.me.o = 1; });
 *
 * Template code organized with help from Claude (Anthropic), Nov 2026.
 */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

  // The cyber palette. Lessons use these names, never raw hex, so the look stays in one place.
  const C = {
    bg: '#070b14', panel: '#0d1424', panel2: '#121c31', grid: '#16223a', line: '#22324f',
    ink: '#e6f1ff', soft: '#8ea3c2', faint: '#5b6f8f',
    cyan: '#22d3ee', green: '#34f5a4', violet: '#a78bfa', amber: '#fbbf24', red: '#fb5a72', blue: '#3b82f6',
  };

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

  function hexRgb(h) {
    if (h.startsWith('rgb')) return h.match(/[\d.]+/g).slice(0, 3).map(Number);
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const isColor = (v) => typeof v === 'string' && (v[0] === '#' || v.startsWith('rgb'));
  function lerpColor(a, b, t) {
    if (a === b || t <= 0) return a;
    if (t >= 1) return b;
    const A = hexRgb(a), B = hexRgb(b);
    return 'rgb(' + A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',') + ')';
  }
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  // Attribute write with a cache, so unchanged attributes cost nothing per frame.
  function setA(node, key, v) {
    const c = node._a || (node._a = {});
    if (c[key] !== v) { c[key] = v; node.setAttribute(key, v); }
  }
  const fmtNum = (n) => Math.round(n).toLocaleString('en-US');

  // Rich text: "**bold**" prints bold in the highlight color; "\n" starts a new line.
  function fillText(textNode, str, cfg) {
    while (textNode.firstChild) textNode.removeChild(textNode.firstChild);
    String(str).split('\n').forEach((line, i) => {
      const ls = el('tspan', { x: 0, dy: i === 0 ? 0 : (cfg.size || 36) * (cfg.lh || 1.25) }, textNode);
      line.split(/(\*\*[^*]+\*\*)/).forEach((part) => {
        if (!part) return;
        const bold = part.startsWith('**');
        const t = el('tspan', {}, ls);
        if (bold) { t.setAttribute('font-weight', 700); t.setAttribute('fill', cfg.hi || C.cyan); }
        t.textContent = bold ? part.slice(2, -2) : part;
      });
    });
  }

  // Line icons on a 24 by 24 grid, drawn inside a node.
  const ICONS = {
    laptop: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
    server: '<rect x="4" y="3" width="16" height="7" rx="1.5"/><rect x="4" y="14" width="16" height="7" rx="1.5"/><path d="M8 6.5h.01M8 17.5h.01M12 6.5h5M12 17.5h5"/>',
    router: '<rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 16.5h.01M11 16.5h.01M8 9.5a6 6 0 0 1 8 0M5.5 7a9.5 9.5 0 0 1 13 0"/>',
    person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.8-1.2"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 20 3M16 7l3 3M14 9l2 2"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    wall: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9.3h18M3 14.7h18M9 4v5.3M15 4v5.3M6 9.3v5.4M12 9.3v5.4M18 9.3v5.4M9 14.7V20M15 14.7V20"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 7 8.5-7"/>',
    hash: '<path d="M9 3 7 21M17 3l-2 18M4 8.5h17M3 15.5h17"/>',
    hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5M14 10.5V5.5a1.5 1.5 0 0 1 3 0V11M17 9.5a1.5 1.5 0 0 1 3 0V14c0 4.4-3 7-7 7-2.6 0-4.4-1.2-5.8-3.3L4.3 13.6a1.5 1.5 0 0 1 2.4-1.8L8 13.5"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
  };

  // ---------------------------------------------------------------- kinds
  // Every kind reads x, y, s (scale) and o (opacity); the props listed in defaults are its own.
  const KINDS = {};
  KINDS.text = {
    defaults: { content: '', fill: C.ink, num: 0, rot: 0 },
    create(g, cfg) {
      const r = el('g', {}, g);
      const mk = () => el('text', { 'font-family': cfg.mono ? MONO : FONT, 'font-size': cfg.size || 36,
        'font-weight': cfg.weight || 500, 'text-anchor': cfg.anchor || 'start', 'letter-spacing': cfg.ls || 0 }, r);
      return { root: r, a: mk(), b: mk(), cfg, sa: null, sb: null };
    },
    update(h, p, from, to, e) {
      setA(h.root, 'transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.rot.toFixed(2)}) scale(${p.s.toFixed(4)})`);
      const str = (q) => (h.cfg.fmt ? h.cfg.fmt.replace('{n}', fmtNum(p.num)) : q.content);
      const ca = str(from), cb = str(to), cross = !h.cfg.fmt && ca !== cb;
      if (h.sa !== ca) { fillText(h.a, ca, h.cfg); h.sa = ca; }
      if (h.sb !== cb) { fillText(h.b, cb, h.cfg); h.sb = cb; }
      setA(h.a, 'fill', p.fill); setA(h.b, 'fill', p.fill);
      setA(h.a, 'opacity', cross ? (p.o * (1 - e)).toFixed(3) : '0');
      setA(h.b, 'opacity', (cross ? p.o * e : p.o).toFixed(3));
    },
  };
  KINDS.rect = {
    defaults: { w: 100, h: 100, rx: 12, fill: C.panel, fo: 1, stroke: C.line, sw: 0 },
    create(g, cfg) { return { r: el('rect', { 'stroke-dasharray': cfg.dash || 'none' }, g) }; },
    update(h, p) {
      const r = h.r;
      setA(r, 'x', p.x.toFixed(2)); setA(r, 'y', p.y.toFixed(2));
      setA(r, 'width', Math.max(0, p.w).toFixed(2)); setA(r, 'height', Math.max(0, p.h).toFixed(2));
      setA(r, 'rx', p.rx); setA(r, 'fill', p.fill); setA(r, 'fill-opacity', p.fo.toFixed(3));
      setA(r, 'stroke', p.stroke); setA(r, 'stroke-width', p.sw); setA(r, 'opacity', p.o.toFixed(3));
    },
  };
  KINDS.dot = {
    defaults: { r: 8, fill: C.cyan, stroke: C.bg, sw: 0 },
    create(g) { return { c: el('circle', {}, g) }; },
    update(h, p) {
      setA(h.c, 'cx', p.x.toFixed(2)); setA(h.c, 'cy', p.y.toFixed(2));
      setA(h.c, 'r', Math.max(0, p.r * p.s).toFixed(2)); setA(h.c, 'fill', p.fill);
      setA(h.c, 'stroke', p.stroke); setA(h.c, 'stroke-width', p.sw); setA(h.c, 'opacity', p.o.toFixed(3));
    },
  };
  // Circle outline, drawn clockwise from 12 o'clock as draw goes from 0 to 1.
  KINDS.ring = {
    defaults: { r: 50, stroke: C.cyan, sw: 4, draw: 1, fill: 'none' },
    create(g, cfg) { return { c: el('circle', { fill: 'none', 'stroke-linecap': 'round' }, g), cfg }; },
    update(h, p) {
      const L = 2 * Math.PI * Math.max(p.r, 0.01);
      setA(h.c, 'cx', p.x.toFixed(2)); setA(h.c, 'cy', p.y.toFixed(2)); setA(h.c, 'r', Math.max(0, p.r).toFixed(2));
      setA(h.c, 'stroke', p.stroke); setA(h.c, 'stroke-width', p.sw); setA(h.c, 'fill', p.fill);
      setA(h.c, 'transform', `rotate(-90 ${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
      setA(h.c, 'stroke-dasharray', h.cfg.dash || `${(L * p.draw).toFixed(2)} ${(L + 1).toFixed(2)}`);
      setA(h.c, 'opacity', (h.cfg.dash || p.draw > 0.002 ? p.o : 0).toFixed(3));
    },
  };
  // Straight arrow from (x, y) to (x2, y2); draw is the fraction of its length shown.
  KINDS.arrow = {
    defaults: { x2: 100, y2: 0, stroke: C.cyan, sw: 5, draw: 1, head: 18 },
    create(g) {
      const r = el('g', {}, g);
      return { root: r, line: el('line', { 'stroke-linecap': 'round' }, r), tip: el('polygon', {}, r) };
    },
    update(h, p) {
      const x2 = lerp(p.x, p.x2, p.draw), y2 = lerp(p.y, p.y2, p.draw);
      const ang = Math.atan2(p.y2 - p.y, p.x2 - p.x), hd = p.head;
      setA(h.line, 'x1', p.x.toFixed(2)); setA(h.line, 'y1', p.y.toFixed(2));
      setA(h.line, 'x2', (x2 - Math.cos(ang) * hd * 0.8).toFixed(2)); setA(h.line, 'y2', (y2 - Math.sin(ang) * hd * 0.8).toFixed(2));
      setA(h.line, 'stroke', p.stroke); setA(h.line, 'stroke-width', p.sw);
      const pts = [[x2, y2], [x2 - Math.cos(ang - 0.45) * hd, y2 - Math.sin(ang - 0.45) * hd],
        [x2 - Math.cos(ang + 0.45) * hd, y2 - Math.sin(ang + 0.45) * hd]];
      setA(h.tip, 'points', pts.map((q) => q.map((v) => v.toFixed(2)).join(',')).join(' '));
      setA(h.tip, 'fill', p.stroke);
      setA(h.root, 'opacity', (p.draw > 0.01 ? p.o : 0).toFixed(3));
    },
  };
  // Fixed SVG path (cfg.d), drawn progressively. cfg.dash gives a dashed line that fades instead.
  KINDS.path = {
    defaults: { stroke: C.line, sw: 4, draw: 1, fill: 'none', rot: 0 },
    create(g, cfg) {
      return { p: el('path', { d: cfg.d, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g), L: null, cfg };
    },
    update(h, p) {
      if (h.L === null) h.L = h.p.getTotalLength() || 1;
      setA(h.p, 'transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.rot.toFixed(2)}) scale(${p.s.toFixed(4)})`);
      setA(h.p, 'stroke', p.stroke); setA(h.p, 'stroke-width', p.sw); setA(h.p, 'fill', p.fill);
      setA(h.p, 'stroke-dasharray', h.cfg.dash || `${(h.L * p.draw).toFixed(2)} ${(h.L + 1).toFixed(2)}`);
      setA(h.p, 'opacity', (h.cfg.dash || p.draw > 0.002 ? p.o : 0).toFixed(3));
    },
  };
  // A device or actor on the network: a rounded tile with a line icon and a label under it.
  //   cfg: icon (a key of ICONS), label, size (tile width, default 132)
  //   props: tint (icon and border color), glow (0 to 1), pulse (0 to 1, a ring that grows and fades)
  KINDS.node = {
    defaults: { tint: C.cyan, glow: 0, pulse: 0 },
    create(g, cfg) {
      const W = cfg.size || 132, r = el('g', {}, g);
      const halo = el('rect', { x: -W / 2 - 10, y: -W / 2 - 10, width: W + 20, height: W + 20, rx: 30, fill: 'none', 'stroke-width': 6 }, r);
      const pulse = el('rect', { fill: 'none', 'stroke-width': 3 }, r);
      const tile = el('rect', { x: -W / 2, y: -W / 2, width: W, height: W, rx: 24, fill: C.panel2, 'stroke-width': 3 }, r);
      const ic = el('g', { fill: 'none', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        transform: `translate(${-W * 0.3} ${-W * 0.3}) scale(${(W * 0.6) / 24})` }, r);
      ic.innerHTML = ICONS[cfg.icon] || ICONS.server;
      let lab = null;
      if (cfg.label) {
        lab = el('text', { x: 0, y: W / 2 + 46, 'text-anchor': 'middle', 'font-family': FONT, 'font-size': cfg.labelSize || 40, 'font-weight': 650, fill: C.ink }, r);
        lab.textContent = cfg.label;
      }
      return { root: r, halo, pulse, tile, ic, W };
    },
    update(h, p) {
      setA(h.root, 'transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) scale(${p.s.toFixed(4)})`);
      setA(h.root, 'opacity', p.o.toFixed(3));
      setA(h.tile, 'stroke', p.tint); setA(h.ic, 'stroke', p.tint);
      setA(h.halo, 'stroke', p.tint); setA(h.halo, 'opacity', (p.glow * 0.55).toFixed(3));
      const g = h.W / 2 + 10 + p.pulse * 60;
      setA(h.pulse, 'x', (-g).toFixed(2)); setA(h.pulse, 'y', (-g).toFixed(2));
      setA(h.pulse, 'width', (2 * g).toFixed(2)); setA(h.pulse, 'height', (2 * g).toFixed(2)); setA(h.pulse, 'rx', 30 + p.pulse * 30);
      setA(h.pulse, 'stroke', p.tint); setA(h.pulse, 'opacity', (p.pulse > 0.001 && p.pulse < 0.999 ? (1 - p.pulse) * 0.8 : 0).toFixed(3));
    },
  };
  // A bare line icon (no tile), centered on (x, y). cfg: icon, size (px, default 72). props: tint, rot.
  KINDS.glyph = {
    defaults: { tint: C.ink, rot: 0 },
    create(g, cfg) {
      const W = cfg.size || 72, r = el('g', {}, g);
      const ic = el('g', { fill: 'none', 'stroke-width': cfg.sw || 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        transform: `translate(${-W / 2} ${-W / 2}) scale(${W / 24})` }, r);
      ic.innerHTML = ICONS[cfg.icon] || ICONS.hand;
      return { root: r, ic };
    },
    update(h, p) {
      setA(h.root, 'transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.rot.toFixed(2)}) scale(${p.s.toFixed(4)})`);
      setA(h.root, 'opacity', p.o.toFixed(3)); setA(h.ic, 'stroke', p.tint);
    },
  };
  // A small piece of data on the move: a rounded chip with a short monospace label, centered on (x, y).
  //   cfg: text, w (default fits the text)
  //   props: fill, ink (label color), glow (0 to 1), content (changes the label, crossfading)
  KINDS.packet = {
    defaults: { fill: C.panel2, ink: C.ink, edge: C.cyan, glow: 0, content: null },
    create(g, cfg) {
      const W = cfg.w || 44 + 26 * String(cfg.text || '').length, H = cfg.h || 64, r = el('g', {}, g);
      const halo = el('rect', { x: -W / 2 - 8, y: -H / 2 - 8, width: W + 16, height: H + 16, rx: 18, fill: 'none', 'stroke-width': 6 }, r);
      const box = el('rect', { x: -W / 2, y: -H / 2, width: W, height: H, rx: 12, 'stroke-width': 3 }, r);
      const mk = () => el('text', { x: 0, y: 12, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': cfg.size || 34, 'font-weight': 700 }, r);
      return { root: r, halo, box, a: mk(), b: mk(), cfg, sa: null, sb: null };
    },
    update(h, p, from, to, e) {
      setA(h.root, 'transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) scale(${p.s.toFixed(4)})`);
      setA(h.root, 'opacity', p.o.toFixed(3));
      setA(h.box, 'fill', p.fill); setA(h.box, 'stroke', p.edge);
      setA(h.halo, 'stroke', p.edge); setA(h.halo, 'opacity', (p.glow * 0.6).toFixed(3));
      const lab = (q) => (q.content == null ? String(h.cfg.text || '') : String(q.content));
      const ca = lab(from), cb = lab(to), cross = ca !== cb;
      if (h.sa !== ca) { h.a.textContent = ca; h.sa = ca; }
      if (h.sb !== cb) { h.b.textContent = cb; h.sb = cb; }
      setA(h.a, 'fill', p.ink); setA(h.b, 'fill', p.ink);
      setA(h.a, 'opacity', cross ? (1 - e).toFixed(3) : '0');
      setA(h.b, 'opacity', cross ? e.toFixed(3) : '1');
    },
  };

  // ---------------------------------------------------------------- scene
  const cloneSnap = (s) => { const o = {}; for (const k in s) o[k] = Object.assign({}, s[k]); return o; };
  class Scene {
    constructor(name, w, h) {
      this.name = name; this.w = w || 1600; this.h = h || 900;
      this.objs = []; this.byId = {}; this.snap = {}; this.steps = []; this.base = null;
    }
    add(id, kind, cfg, props) {
      if (this.byId[id]) throw new Error('duplicate id ' + id);
      if (this.steps.length) throw new Error(`${this.name}: add '${id}' before the first step`);
      if (!KINDS[kind]) throw new Error(`${this.name}: unknown kind '${kind}'`);
      const o = { id, kind, cfg: cfg || {}, idx: this.objs.length };
      this.objs.push(o); this.byId[id] = o;
      this.snap[id] = Object.assign({ x: 0, y: 0, o: 1, s: 1, z: 0 }, KINDS[kind].defaults, props || {});
      return id;
    }
    // Start a step (one click of Next). meta: {head, body} is the caption under the stage.
    step(meta) {
      if (!this.base) this.base = cloneSnap(this.snap);
      this.steps.push({ meta: meta || {}, beats: [] });
      return this;
    }
    // Append a beat: copy the current snapshot, let mut(s) change it, play it over dur seconds.
    // timing(id) may return {w: [a, b]} to play an object only in that slice of the beat (a stagger),
    // and {arc: px} to lift it along an arc as it moves.
    beat(dur, mut, timing) {
      const s = cloneSnap(this.snap);
      if (mut) mut(s);
      this.steps[this.steps.length - 1].beats.push({ dur, snap: s, timing: timing || null });
      this.snap = s;
      return this;
    }
    hold(dur) { return this.beat(dur, null); }
    stepStart(i) { return i === 0 ? this.base : this.stepEnd(i - 1); }
    stepEnd(i) { const b = this.steps[i].beats; return b.length ? b[b.length - 1].snap : this.stepStart(i); }
    duration(i) { return this.steps[i].beats.reduce((a, b) => a + b.dur, 0); }
  }

  // ---------------------------------------------------------------- player
  class Player {
    constructor(svg, scene) {
      this.svg = svg; this.scene = scene;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute('viewBox', `0 0 ${scene.w} ${scene.h}`);
      this.layer = el('g', {}, svg);
      this.h = {};
      scene.objs.forEach((o) => {
        const h = KINDS[o.kind].create(this.layer, o.cfg);
        h._node = h.root || h.r || h.c || h.p;
        this.h[o.id] = h;
      });
      this.orderKey = '';
    }
    renderBase() { const s = this.scene.base; this._draw(s, s, 1, null); }
    // Draw step i at t seconds into it.
    render(i, t) {
      const sc = this.scene, beats = sc.steps[i].beats;
      let prev = sc.stepStart(i), cur = prev, p = 1, timing = null, acc = 0;
      for (let j = 0; j < beats.length; j++) {
        const b = beats[j];
        if (t < acc + b.dur || j === beats.length - 1) {
          prev = j === 0 ? sc.stepStart(i) : beats[j - 1].snap;
          cur = b.snap; timing = b.timing;
          p = b.dur > 0 ? clamp((t - acc) / b.dur, 0, 1) : 1;
          break;
        }
        acc += b.dur;
      }
      this._draw(prev, cur, p, timing);
    }
    renderEnd(i) { const s = this.scene.stepEnd(i); this._draw(s, s, 1, null); }
    _draw(A, B, p, timing) {
      const zs = [];
      for (const o of this.scene.objs) {
        const a = A[o.id], b = B[o.id];
        let lp = p, arc = 0;
        const tm = timing && timing(o.id);
        if (tm) {
          if (tm.w) lp = clamp((p - tm.w[0]) / Math.max(1e-6, tm.w[1] - tm.w[0]), 0, 1);
          if (tm.arc) arc = tm.arc;
        }
        const e = easeInOut(lp), q = {};
        for (const k in b) {
          const va = a[k], vb = b[k];
          if (typeof vb === 'number' && typeof va === 'number') q[k] = lerp(va, vb, e);
          else if (isColor(vb) && isColor(va)) q[k] = lerpColor(va, vb, e);
          else q[k] = e < 0.5 ? va : vb;
        }
        if (arc) q.y += -arc * Math.sin(Math.PI * e);
        KINDS[o.kind].update(this.h[o.id], q, a, b, e);
        zs.push([q.z, o.idx, o.id]);
      }
      zs.sort((u, v) => u[0] - v[0] || u[1] - v[1]);
      const key = zs.map((z) => z[1]).join(',');
      if (key !== this.orderKey) { this.orderKey = key; zs.forEach((z) => this.layer.appendChild(this.h[z[2]]._node)); }
    }
  }

  root.Anim = { Scene, Player, KINDS, ICONS, C, el, easeInOut, fmtNum, FONT, MONO };
})(this);
