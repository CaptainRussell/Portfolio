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
    blender: '<path d="M6 3h12l-1.6 11H7.6z"/><path d="M7.6 14h8.8l.6 3H7z"/><rect x="6" y="17" width="12" height="4" rx="1"/><path d="M10 7.5l4 3M14 7.5l-4 3"/>',
    salt: '<path d="M8 9h8l1 12H7z"/><path d="M8 9a4 4 0 0 1 8 0"/><path d="M10.5 5.5h.01M12 4.5h.01M13.5 5.5h.01"/>',
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
  // A paint can (Lesson 2), centered on (x, y). cfg: size (body width, default 110).
  //   props: paint (color; colors blend smoothly), edge, glow, rot (tilt, for pouring),
  //   cover (0 to 1: a face-down cover with a "?" hides the paint), tag (label under the can).
  KINDS.can = {
    defaults: { paint: C.cyan, edge: C.soft, glow: 0, rot: 0, cover: 0, tag: '' },
    create(g, cfg) {
      const W = cfg.size || 110, H = W * 0.92, top = -H / 2 + 12, r = el('g', {}, g);
      const halo = el('rect', { x: -W / 2 - 14, y: -H / 2 - 30, width: W + 28, height: H + 44, rx: 22, fill: 'none', 'stroke-width': 6 }, r);
      const body = el('g', {}, r);
      const handle = el('path', { d: `M ${-W * 0.42} ${top} C ${-W * 0.42} ${top - W * 0.42}, ${W * 0.42} ${top - W * 0.42}, ${W * 0.42} ${top}`,
        fill: 'none', 'stroke-width': 4 }, body);
      const can = el('path', { d: `M ${-W / 2} ${top} L ${W / 2} ${top} L ${W * 0.43} ${H / 2 - 6} Q ${W * 0.42} ${H / 2} ${W * 0.36} ${H / 2} L ${-W * 0.36} ${H / 2} Q ${-W * 0.42} ${H / 2} ${-W * 0.43} ${H / 2 - 6} Z`,
        'stroke-width': 3, 'stroke-linejoin': 'round' }, body);
      const shine = el('path', { d: `M ${-W * 0.3} ${top + 16} L ${-W * 0.26} ${H / 2 - 14}`, stroke: '#ffffff', 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0.28 }, body);
      const rim = el('ellipse', { cx: 0, cy: top, rx: W / 2, ry: W * 0.11, 'stroke-width': 3 }, body);
      const cover = el('g', {}, body);
      el('path', { d: `M ${-W / 2 - 3} ${top} L ${W / 2 + 3} ${top} L ${W * 0.45} ${H / 2 + 2} L ${-W * 0.45} ${H / 2 + 2} Z`, fill: C.panel2, stroke: C.faint, 'stroke-width': 3 }, cover);
      el('ellipse', { cx: 0, cy: top, rx: W / 2 + 3, ry: W * 0.11 + 3, fill: C.panel2, stroke: C.faint, 'stroke-width': 3 }, cover);
      const q = el('text', { x: 0, y: W * 0.2, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': W * 0.5, 'font-weight': 800, fill: C.soft }, cover);
      q.textContent = '?';
      const lab = el('text', { x: 0, y: H / 2 + 34, 'text-anchor': 'middle', 'font-family': FONT, 'font-size': cfg.labelSize || 26, 'font-weight': 650, fill: C.ink }, r);
      return { root: r, halo, body, handle, can, shine, rim, cover, lab, W, H, sl: null };
    },
    update(h, p, from, to, e) {
      setA(h.root, 'transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) scale(${p.s.toFixed(4)})`);
      setA(h.root, 'opacity', p.o.toFixed(3));
      setA(h.body, 'transform', `rotate(${p.rot.toFixed(2)})`);
      setA(h.can, 'fill', p.paint); setA(h.rim, 'fill', p.paint);
      setA(h.can, 'stroke', p.edge); setA(h.rim, 'stroke', p.edge); setA(h.handle, 'stroke', p.edge);
      setA(h.halo, 'stroke', p.edge); setA(h.halo, 'opacity', (p.glow * 0.6).toFixed(3));
      setA(h.cover, 'opacity', p.cover.toFixed(3));
      const tag = e < 0.5 ? from.tag : to.tag;
      if (h.sl !== tag) { h.lab.textContent = tag || ''; h.sl = tag; }
    },
  };
  // A fingerprint (Lesson 3): bars colored and sized from a hex hash, with the start of the hash under them.
  //   cfg: w, h (bar area, default 520 by 90), n (bars, default 16), size (hash text, default 24), text (false hides it)
  //   props: hex (the hash; bars blend when it changes), edge
  const hsl = (h, s, l) => {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [255 * f(0), 255 * f(8), 255 * f(4)];
  };
  function barSpec(hex, i) {
    if (!hex) return { c: [60, 76, 104], f: 0.5 };
    const b1 = parseInt(hex.substr((i * 2) % 64, 2), 16), b2 = parseInt(hex.substr((i * 2 + 32) % 64, 2), 16);
    return { c: hsl((b1 / 256) * 360, 78, 58), f: 0.35 + 0.65 * (b2 / 255) };
  }
  KINDS.barcode = {
    defaults: { hex: '', edge: C.line },
    create(g, cfg) {
      const W = cfg.w || 520, H = cfg.h || 90, n = cfg.n || 16, r = el('g', {}, g);
      const frame = el('rect', { x: -W / 2 - 12, y: -H / 2 - 12, width: W + 24, height: H + 24, rx: 14, fill: C.panel, 'stroke-width': 2 }, r);
      const bw = W / n, bars = [];
      for (let i = 0; i < n; i++) bars.push(el('rect', { x: -W / 2 + i * bw + bw * 0.12, width: bw * 0.76, rx: 3 }, r));
      const mk = () => el('text', { x: 0, y: H / 2 + 46, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': cfg.size || 24, 'font-weight': 600, fill: C.soft }, r);
      return { root: r, frame, bars, W, H, n, a: mk(), b: mk(), cfg, sa: null, sb: null };
    },
    update(h, p, from, to, e) {
      setA(h.root, 'transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) scale(${p.s.toFixed(4)})`);
      setA(h.root, 'opacity', p.o.toFixed(3)); setA(h.frame, 'stroke', p.edge);
      h.bars.forEach((bar, i) => {
        const A = barSpec(from.hex, i), B = barSpec(to.hex, i), f = lerp(A.f, B.f, e);
        const c = 'rgb(' + A.c.map((v, j) => Math.round(lerp(v, B.c[j], e))).join(',') + ')';
        setA(bar, 'fill', c); setA(bar, 'height', (h.H * f).toFixed(2)); setA(bar, 'y', (h.H / 2 - h.H * f).toFixed(2));
      });
      const lab = (q) => (h.cfg.text === false || !q.hex ? '' : q.hex.slice(0, 16) + '…');
      const ca = lab(from), cb = lab(to), cross = ca !== cb;
      if (h.sa !== ca) { h.a.textContent = ca; h.sa = ca; }
      if (h.sb !== cb) { h.b.textContent = cb; h.sb = cb; }
      setA(h.a, 'opacity', cross ? (1 - e).toFixed(3) : '0'); setA(h.b, 'opacity', cross ? e.toFixed(3) : '1');
    },
  };
  // ---------------------------------------------------------------- the cast
  // Alice and Bob as people, from the Card Deck Cipher slides (projects/daniels-cipher/slides): a white face with a
  // dark outline; Alice with hair to her shoulders and a cardinal top, Bob with short hair. Centered on (x, y).
  //   cfg: who ('alice' or 'bob'), label (default the name), labelSize
  //   props: glow (0 to 1), pulse (0 to 1), tint (halo color)
  const AGENT_BODY = 'M -46 64 C -46 27 -26 15 0 15 C 26 15 46 27 46 64 Z';
  const AGENT_HAIR = { long: 'M -31 -12 C -33 -62 33 -62 31 -12 L 33 22 C 20 29 -20 29 -33 22 Z',
    short: 'M -25 -15 C -27 -50 27 -50 25 -15 C 19 -28 -11 -33 -25 -15 Z' };
  KINDS.person = {
    defaults: { tint: C.cyan, glow: 0, pulse: 0 },
    create(g, cfg) {
      const long = cfg.who !== 'bob', r = el('g', {}, g);
      const halo = el('circle', { cx: 0, cy: 0, r: 86, fill: 'none', 'stroke-width': 6 }, r);
      const pulse = el('circle', { cx: 0, cy: 0, fill: 'none', 'stroke-width': 3 }, r);
      el('circle', { cx: 0, cy: 0, r: 76, fill: C.panel2, stroke: C.line, 'stroke-width': 3 }, r);
      const fig = el('g', { transform: 'translate(0 -6) scale(0.92)' }, r);
      const line = '#0a0f1c';
      if (long) el('path', { d: AGENT_HAIR.long, fill: '#1b1410', stroke: '#c9b8a8', 'stroke-width': 1.5 }, fig);
      el('path', { d: AGENT_BODY, fill: long ? '#c8102e' : '#5b6b86', stroke: line, 'stroke-width': 2 }, fig);
      el('circle', { cx: 0, cy: long ? -13 : -15, r: long ? 20 : 23, fill: '#ffffff', stroke: line, 'stroke-width': 3 }, fig);
      if (!long) el('path', { d: AGENT_HAIR.short, fill: '#1b1410', stroke: '#c9b8a8', 'stroke-width': 1.5 }, fig);
      const lab = el('text', { x: 0, y: 76 + 46, 'text-anchor': 'middle', 'font-family': FONT, 'font-size': cfg.labelSize || 40, 'font-weight': 650, fill: C.ink }, r);
      lab.textContent = cfg.label || (long ? 'Alice' : 'Bob');
      return { root: r, halo, pulse };
    },
    update(h, p) {
      setA(h.root, 'transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) scale(${p.s.toFixed(4)})`);
      setA(h.root, 'opacity', p.o.toFixed(3));
      setA(h.halo, 'stroke', p.tint); setA(h.halo, 'opacity', (p.glow * 0.6).toFixed(3));
      setA(h.pulse, 'r', (82 + p.pulse * 60).toFixed(2)); setA(h.pulse, 'stroke', p.tint);
      setA(h.pulse, 'opacity', (p.pulse > 0.001 && p.pulse < 0.999 ? (1 - p.pulse) * 0.8 : 0).toFixed(3));
    },
  };
  // Eve's eye, from the Card Deck Cipher slides: a white almond with a dark iris and a glint.
  //   cfg: label (default 'Eve'), size (width, default 150)
  //   props: look (-1 to 1, where the iris looks, left to right), lookY, glow, pulse, tint
  KINDS.eye = {
    defaults: { look: 0, lookY: 0, glow: 0, pulse: 0, tint: C.red },
    create(g, cfg) {
      const W = cfg.size || 150, k = W / 128, r = el('g', {}, g);
      const halo = el('path', { d: 'M -64 0 Q 0 -50 64 0 Q 0 50 -64 0 Z', fill: 'none', 'stroke-width': 10, transform: `scale(${k * 1.12})` }, r);
      const pulse = el('path', { d: 'M -64 0 Q 0 -50 64 0 Q 0 50 -64 0 Z', fill: 'none', 'stroke-width': 3 }, r);
      el('path', { d: 'M -64 0 Q 0 -50 64 0 Q 0 50 -64 0 Z', fill: '#ffffff', stroke: '#0a0f1c', 'stroke-width': 4, transform: `scale(${k})` }, r);
      const iris = el('g', {}, r);
      el('circle', { cx: 0, cy: 0, r: 22 * k, fill: '#0a0f1c' }, iris);
      el('circle', { cx: -7 * k, cy: -7 * k, r: 6 * k, fill: '#ffffff' }, iris);
      const lab = el('text', { x: 0, y: 30 * k + 46, 'text-anchor': 'middle', 'font-family': FONT, 'font-size': cfg.labelSize || 40, 'font-weight': 650, fill: C.red }, r);
      lab.textContent = cfg.label == null ? 'Eve' : cfg.label;
      return { root: r, halo, pulse, iris, k };
    },
    update(h, p) {
      setA(h.root, 'transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) scale(${p.s.toFixed(4)})`);
      setA(h.root, 'opacity', p.o.toFixed(3));
      setA(h.iris, 'transform', `translate(${(p.look * 26 * h.k).toFixed(2)} ${(p.lookY * 8 * h.k).toFixed(2)})`);
      setA(h.halo, 'stroke', p.tint); setA(h.halo, 'opacity', (p.glow * 0.55).toFixed(3));
      const sc = h.k * (1.15 + p.pulse * 0.6);
      setA(h.pulse, 'transform', `scale(${sc.toFixed(4)})`); setA(h.pulse, 'stroke', p.tint);
      setA(h.pulse, 'opacity', (p.pulse > 0.001 && p.pulse < 0.999 ? (1 - p.pulse) * 0.8 : 0).toFixed(3));
    },
  };
  // A big key that can be painted (Lesson 2). props: paint (fill color), edge, glow, rot.
  KINDS.keyart = {
    defaults: { paint: '#ffffff', edge: C.ink, glow: 0, rot: 0, turn: 0 },
    create(g) {
      const r = el('g', {}, g), body = el('g', {}, r);
      const halo = el('circle', { cx: -60, cy: 0, r: 56, fill: 'none', 'stroke-width': 8 }, body);
      const shapes = [el('circle', { cx: -60, cy: 0, r: 40, 'stroke-width': 4 }, body),
        el('path', { d: 'M -24 -11 H 96 V 11 H 86 V 32 H 72 V 11 H 62 V 36 H 48 V 11 H -24 Z', 'stroke-width': 4, 'stroke-linejoin': 'round' }, body)];
      el('circle', { cx: -60, cy: 0, r: 14, fill: C.bg, 'stroke-width': 3, stroke: C.line }, body);
      return { root: r, body, halo, shapes };
    },
    update(h, p) {
      setA(h.root, 'transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) scale(${p.s.toFixed(4)})`);
      // turn (degrees) spins the key about its own shaft, the way a key turns in a lock
      setA(h.root, 'opacity', p.o.toFixed(3)); setA(h.body, 'transform', `rotate(${p.rot.toFixed(2)}) scale(1 ${Math.cos(p.turn * Math.PI / 180).toFixed(4)})`);
      h.shapes.forEach((s) => { setA(s, 'fill', p.paint); setA(s, 'stroke', p.edge); });
      setA(h.halo, 'stroke', p.paint); setA(h.halo, 'opacity', (p.glow * 0.6).toFixed(3));
    },
  };
  // A salt shaker (Lesson 3), mouth up, centered on (x, y). cfg.style 'tall' (a slim glass shaker) or 'round'
  //   (a squat grinder), so two sites' salts look different. props: rot (tilt), grain (salt color), glow
  KINDS.shaker = {
    defaults: { rot: 0, grain: '#ffffff', glow: 0 },
    create(g, cfg) {
      const r = el('g', {}, g), round = cfg.style === 'round';
      const halo = el('circle', { cx: 0, cy: 0, r: 70, fill: 'none', 'stroke-width': 6 }, r);
      let fill;
      if (round) {
        fill = el('circle', { cx: 0, cy: 14, r: 34, opacity: 0.85 }, r);
        el('circle', { cx: 0, cy: 14, r: 40, fill: 'rgba(230,241,255,.08)', stroke: '#e6f1ff', 'stroke-width': 4 }, r);
        el('rect', { x: -30, y: -40, width: 60, height: 20, rx: 6, fill: '#8a5a2b', stroke: '#e6f1ff', 'stroke-width': 3 }, r);
        el('rect', { x: -8, y: -56, width: 16, height: 18, rx: 4, fill: '#8a5a2b', stroke: '#e6f1ff', 'stroke-width': 3 }, r);
      } else {
        fill = el('rect', { x: -18, y: -14, width: 36, height: 58, rx: 6, opacity: 0.85 }, r);
        el('rect', { x: -22, y: -30, width: 44, height: 78, rx: 10, fill: 'rgba(230,241,255,.08)', stroke: '#e6f1ff', 'stroke-width': 4 }, r);
        el('path', { d: 'M -22 -30 C -22 -58 22 -58 22 -30 Z', fill: '#94a3b8', stroke: '#e6f1ff', 'stroke-width': 3 }, r);
        [[-8, -40], [0, -46], [8, -40]].forEach(([x, y]) => el('circle', { cx: x, cy: y, r: 2.6, fill: '#0a0f1c' }, r));
      }
      return { root: r, halo, fill };
    },
    update(h, p) {
      setA(h.root, 'transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.rot.toFixed(2)}) scale(${p.s.toFixed(4)})`);
      setA(h.root, 'opacity', p.o.toFixed(3)); setA(h.fill, 'fill', p.grain);
      setA(h.halo, 'stroke', p.grain); setA(h.halo, 'opacity', (p.glow * 0.6).toFixed(3));
    },
  };
  // A padlock seen from the front, with a keyhole a key can slide into (Lesson 2).
  //   props: open (0 shut to 1 shackle up), turn (keyhole angle, degrees), tint, glow
  KINDS.padlock = {
    defaults: { open: 0, turn: 0, tint: C.soft, glow: 0 },
    create(g) {
      const r = el('g', {}, g);
      const halo = el('rect', { x: -52, y: -42, width: 104, height: 88, rx: 18, fill: 'none', 'stroke-width': 6 }, r);
      const shackle = el('path', { d: 'M -24 0 V -58 A 24 24 0 0 1 24 -58 V -30', fill: 'none', 'stroke-width': 11, 'stroke-linecap': 'round' }, r);
      const body = el('rect', { x: -42, y: -32, width: 84, height: 68, rx: 12, 'stroke-width': 4 }, r);
      const hole = el('g', {}, r);
      el('circle', { cx: 0, cy: -2, r: 9, fill: C.bg }, hole);
      el('path', { d: 'M -5 2 L -8 20 H 8 L 5 2 Z', fill: C.bg }, hole);
      return { root: r, halo, shackle, body, hole };
    },
    update(h, p) {
      setA(h.root, 'transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) scale(${p.s.toFixed(4)})`);
      setA(h.root, 'opacity', p.o.toFixed(3));
      setA(h.shackle, 'transform', `translate(0 ${(-20 * p.open).toFixed(2)})`); setA(h.shackle, 'stroke', p.tint);
      setA(h.body, 'fill', C.panel2); setA(h.body, 'stroke', p.tint);
      setA(h.hole, 'transform', `translate(0 6) rotate(${p.turn.toFixed(2)})`);
      setA(h.halo, 'stroke', p.tint); setA(h.halo, 'opacity', (p.glow * 0.6).toFixed(3));
    },
  };
  // A blender (Lesson 3): a jar with blades that spin as spin grows (1 = one full turn), and a whirl of shreds.
  //   props: spin, chop (0 to 1, how full of shreds), tint, glow
  KINDS.blender = {
    defaults: { spin: 0, chop: 0, tint: C.amber, glow: 0 },
    create(g, cfg) {
      const r = el('g', {}, g), W = cfg.size || 1;
      const halo = el('rect', { x: -110, y: -150, width: 220, height: 330, rx: 30, fill: 'none', 'stroke-width': 8 }, r);
      const jar = el('path', { d: 'M -90 -130 H 90 L 66 80 H -66 Z', fill: 'rgba(34,211,238,.06)', 'stroke-width': 5, 'stroke-linejoin': 'round' }, r);
      const base = el('rect', { x: -80, y: 80, width: 160, height: 70, rx: 14, fill: C.panel2, 'stroke-width': 5 }, r);
      const knob = el('circle', { cx: 0, cy: 115, r: 14, 'stroke-width': 4, fill: C.panel }, r);
      const shreds = el('g', {}, r), bits = [];
      for (let i = 0; i < 22; i++) {
        const b = el('rect', { width: 14 + (i % 3) * 6, height: 8, rx: 2 }, shreds);
        bits.push({ b, a: (i * 137.5) % 360, rr: 18 + ((i * 29) % 52), y: -20 - ((i * 37) % 80), c: [C.cyan, C.violet, C.amber, C.green, C.red][i % 5] });
      }
      const blades = el('g', {}, r);
      el('path', { d: 'M -46 0 Q 0 -14 46 0 Q 0 14 -46 0 Z', 'stroke-width': 3 }, blades);
      el('path', { d: 'M 0 -30 Q 10 0 0 30 Q -10 0 0 -30 Z', 'stroke-width': 3 }, blades);
      return { root: r, halo, jar, base, knob, blades, bits, W };
    },
    update(h, p) {
      setA(h.root, 'transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) scale(${p.s.toFixed(4)})`);
      setA(h.root, 'opacity', p.o.toFixed(3));
      [h.jar, h.base, h.knob].forEach((n) => setA(n, 'stroke', p.tint));
      setA(h.halo, 'stroke', p.tint); setA(h.halo, 'opacity', (p.glow * 0.5).toFixed(3));
      setA(h.blades, 'transform', `translate(0 52) rotate(${(p.spin * 360).toFixed(1)}) scale(1 0.45)`);
      h.blades.querySelectorAll('path').forEach((n) => { setA(n, 'stroke', p.tint); setA(n, 'fill', C.panel2); });
      h.bits.forEach((q, i) => {
        const ang = ((q.a + p.spin * 520 * (i % 2 ? 1 : -1.3)) * Math.PI) / 180;
        const x = Math.cos(ang) * q.rr, y = q.y + Math.sin(ang) * 18 * p.chop;
        setA(q.b, 'x', x.toFixed(2)); setA(q.b, 'y', y.toFixed(2)); setA(q.b, 'fill', q.c);
        setA(q.b, 'transform', `rotate(${((p.spin * 900 + i * 40) % 360).toFixed(1)} ${(x + 7).toFixed(1)} ${(y + 4).toFixed(1)})`);
        setA(q.b, 'opacity', Math.max(0, Math.min(1, p.chop * 1.4 - (i % 4) * 0.08)).toFixed(3));
      });
    },
  };
  // A fingerprint drawn from a hash (Lesson 3): about a dozen ridges whose shape, breaks, tilt and colors all come
  // from the hash bytes, so one changed letter gives a completely different print. The hash prints small underneath.
  //   cfg: r (radius, default 120), text (false hides the hash)
  //   props: hex, edge
  function printPaths(hex, R) {
    R = R || 120;
    if (!hex) return { paths: [], tilt: 0 };
    const b = (i) => parseInt(hex.substr((i * 2) % 64, 2), 16);
    const type = b(0) % 3, tilt = (b(1) / 255) * 70 - 35, cx = ((b(2) / 255) - 0.5) * R * 0.35, cy = ((b(3) / 255) - 0.5) * R * 0.3;
    const hue1 = (b(4) / 255) * 360, hue2 = (hue1 + 70 + (b(5) / 255) * 140) % 360;
    const paths = [], n = 11;
    for (let k = 1; k <= n; k++) {
      const rr = (R * 0.9 * k) / n, sq = type === 2 ? 0.55 : 0.82, gap = 30 + (b(6 + k) / 255) * 70;
      let a0, a1;
      if (type === 0) { a0 = 200 + gap / 2; a1 = 520 - gap / 2; }                 // loop, open at the bottom
      else if (type === 1) { a0 = (b(18 + k) / 255) * 360; a1 = a0 + 360 - gap; }  // whorl, broken at random
      else { a0 = 190; a1 = 350; }                                                   // arch
      const brk = 0.35 + (b(30 + k) / 255) * 0.3, pts = (t0, t1) => {
        const st = (t0 * Math.PI) / 180, en = (t1 * Math.PI) / 180;
        const x0 = cx + rr * Math.cos(st), y0 = cy + rr * sq * Math.sin(st), x1 = cx + rr * Math.cos(en), y1 = cy + rr * sq * Math.sin(en);
        return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${rr.toFixed(1)} ${(rr * sq).toFixed(1)} 0 ${t1 - t0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
      };
      const mid = a0 + (a1 - a0) * brk;
      const col = `hsl(${(k % 2 ? hue1 : hue2).toFixed(0)} 80% ${(52 + (k % 3) * 6).toFixed(0)}%)`;
      paths.push({ d: pts(a0, mid - 6), c: col }, { d: pts(mid + 6, a1), c: col });
    }
    return { paths, tilt };
  }
  KINDS.print = {
    defaults: { hex: '', edge: C.line },
    create(g, cfg) {
      const R = cfg.r || 120, r = el('g', {}, g);
      const frame = el('rect', { x: -R - 18, y: -R - 18, width: 2 * R + 36, height: 2 * R + 36, rx: 26, fill: C.panel, 'stroke-width': 2 }, r);
      const A = el('g', {}, r), B = el('g', {}, r);
      const mk = () => el('text', { x: 0, y: R + 58, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': cfg.size || 24, 'font-weight': 600, fill: C.soft }, r);
      return { root: r, frame, A, B, R, cfg, ta: mk(), tb: mk(), ha: null, hb: null };
    },
    update(h, p, from, to, e) {
      setA(h.root, 'transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) scale(${p.s.toFixed(4)})`);
      setA(h.root, 'opacity', p.o.toFixed(3)); setA(h.frame, 'stroke', p.edge);
      const draw = (grp, hex) => {
        while (grp.firstChild) grp.removeChild(grp.firstChild);
        const P = printPaths(hex, h.R);
        grp.setAttribute('transform', `rotate(${P.tilt.toFixed(1)})`);
        P.paths.forEach((q) => el('path', { d: q.d, fill: 'none', stroke: q.c, 'stroke-width': 5, 'stroke-linecap': 'round' }, grp));
      };
      if (h.ha !== from.hex) { draw(h.A, from.hex); h.ha = from.hex; }
      if (h.hb !== to.hex) { draw(h.B, to.hex); h.hb = to.hex; }
      const cross = from.hex !== to.hex;
      // the old print spins away as the new one spins in
      setA(h.A, 'opacity', cross ? (1 - e).toFixed(3) : '0');
      setA(h.B, 'opacity', cross ? e.toFixed(3) : '1');
      if (cross) {
        const P0 = printPaths(from.hex, h.R).tilt, P1 = printPaths(to.hex, h.R).tilt;
        h.A.setAttribute('transform', `rotate(${(P0 - e * 180).toFixed(1)}) scale(${(1 - e * 0.4).toFixed(3)})`);
        h.B.setAttribute('transform', `rotate(${(P1 + (1 - e) * 180).toFixed(1)}) scale(${(0.6 + e * 0.4).toFixed(3)})`);
      } else if (h.B._t !== to.hex) { h.B.setAttribute('transform', `rotate(${printPaths(to.hex, h.R).tilt.toFixed(1)})`); h.B._t = to.hex; }
      const lab = (q) => (h.cfg.text === false || !q.hex ? '' : q.hex.slice(0, 16) + '…');
      const ca = lab(from), cb = lab(to);
      h.ta.textContent = ca; h.tb.textContent = cb;
      setA(h.ta, 'opacity', ca !== cb ? (1 - e).toFixed(3) : '0'); setA(h.tb, 'opacity', ca !== cb ? e.toFixed(3) : '1');
    },
  };
  // A section card: a full-stage title that sweeps in between parts of a lesson (shared by all four lessons).
  // Call Anim.addSection(S) before the first step, then Anim.section(S, 'Part 2', 'Title') at the start of a step.
  function addSection(S) {
    S.add('secBg', 'rect', {}, { x: 0, y: 0, w: S.w, h: S.h, rx: 0, fill: C.bg, fo: 0.92, sw: 0, o: 0, z: 50 });
    S.add('secLine', 'rect', {}, { x: S.w / 2 - 160, y: S.h / 2 + 4, w: 0, h: 5, rx: 3, fill: C.cyan, sw: 0, o: 0, z: 51 });
    S.add('secK', 'text', { size: 30, weight: 700, mono: true, anchor: 'middle', ls: 6 }, { x: S.w / 2, y: S.h / 2 - 70, content: '', fill: C.cyan, o: 0, z: 51 });
    S.add('secT', 'text', { size: 72, weight: 800, anchor: 'middle' }, { x: S.w / 2, y: S.h / 2 - 12, content: '', fill: C.ink, o: 0, z: 51 });
  }
  function section(S, kicker, title, hide) {
    S.beat(0.45, (s) => { Object.assign(s.secBg, { o: 1 }); Object.assign(s.secK, { o: 1, content: kicker }); Object.assign(s.secT, { o: 1, content: title }); Object.assign(s.secLine, { o: 1, w: 320 }); });
    S.beat(0.9, (s) => { if (hide) hide(s); });
    S.beat(0.45, (s) => { s.secBg.o = 0; s.secK.o = 0; s.secT.o = 0; Object.assign(s.secLine, { o: 0, w: 0 }); });
    return S;
  }
  // A small inline SVG fingerprint for page controls.
  function printSVG(hex, px) {
    const P = printPaths(hex, 120);
    return `<svg viewBox="-140 -140 280 280" width="${px || 34}" height="${px || 34}" aria-hidden="true" style="vertical-align:middle;background:${C.panel};border-radius:8px">
      <g transform="rotate(${P.tilt.toFixed(1)})">${P.paths.map((q) => `<path d="${q.d}" fill="none" stroke="${q.c}" stroke-width="9" stroke-linecap="round"/>`).join('')}</g></svg>`;
  }

  // A small piece of data on the move: a rounded chip with a short monospace label, centered on (x, y).
  //   cfg: text, w (default fits the text), num (a packet number, shown in its own tab behind a divider
  //   so it cannot be mistaken for the message), tab (that tab's width, default 44)
  //   props: fill, ink (label color), glow (0 to 1), content (changes the label, crossfading)
  KINDS.packet = {
    defaults: { fill: C.panel2, ink: C.ink, edge: C.cyan, glow: 0, content: null },
    create(g, cfg) {
      const W = cfg.w || 44 + 26 * String(cfg.text || '').length, H = cfg.h || 64, r = el('g', {}, g);
      const halo = el('rect', { x: -W / 2 - 8, y: -H / 2 - 8, width: W + 16, height: H + 16, rx: 18, fill: 'none', 'stroke-width': 6 }, r);
      const box = el('rect', { x: -W / 2, y: -H / 2, width: W, height: H, rx: 12, 'stroke-width': 3 }, r);
      const T = cfg.num != null ? cfg.tab || 44 : 0, fs = cfg.size || 34;
      let line = null;
      if (T) {
        el('path', { d: `M ${-W / 2 + 12} ${-H / 2} H ${-W / 2 + T} V ${H / 2} H ${-W / 2 + 12} A 12 12 0 0 1 ${-W / 2} ${H / 2 - 12} V ${-H / 2 + 12} A 12 12 0 0 1 ${-W / 2 + 12} ${-H / 2} Z`, fill: 'rgba(251,191,36,.16)' }, r);
        line = el('path', { d: `M ${-W / 2 + T} ${-H / 2 + 3} V ${H / 2 - 3}`, 'stroke-width': 3 }, r);
        const t = el('text', { x: -W / 2 + T / 2, y: 0.36 * fs * 0.85, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': fs * 0.85, 'font-weight': 800, fill: C.amber }, r);
        t.textContent = String(cfg.num);
      }
      const mk = () => el('text', { x: T / 2, y: 12, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': fs, 'font-weight': 700 }, r);
      return { root: r, halo, box, line, a: mk(), b: mk(), cfg, sa: null, sb: null };
    },
    update(h, p, from, to, e) {
      setA(h.root, 'transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) scale(${p.s.toFixed(4)})`);
      setA(h.root, 'opacity', p.o.toFixed(3));
      setA(h.box, 'fill', p.fill); setA(h.box, 'stroke', p.edge); if (h.line) setA(h.line, 'stroke', p.edge);
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

  root.Anim = { Scene, Player, KINDS, ICONS, C, el, easeInOut, fmtNum, FONT, MONO, barSpec, addSection, section, printSVG, printPaths };
})(this);
