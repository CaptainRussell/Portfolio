/* Financial Readiness: the presenter deck.
 * One 1600 x 900 stage, scaled to fit. Slides are either a step of a chapter scene (the same animations
 * as the lesson, from ../lessons/cN/scene.js) or a live slide with big sliders that redraw as you drag.
 * Nothing on the stage moves the deck on: the right arrow, Space, PageDown or a clicker does.
 * Code organized with help from Claude (Anthropic), Nov 2026.
 */
(function () {
  'use strict';
  // the Treasury palette (deck.css): navy panels, gold, paper white. Set before any scene is built.
  Object.assign(Anim.C, { bg: '#0a1428', panel: '#0f1e3a', panel2: '#152a4d', line: '#2b4370', ink: '#f4efe3', soft: '#b3bfd4', faint: '#7083a6',
    cyan: '#4ea8ff', green: '#3fd69a', violet: '#a99bf5', amber: '#e8b54a', red: '#ff6f7d', blue: '#5b8def' });
  const { C, Player } = Anim;
  const fmt = FR.fmt;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const md = (s) => esc(s || '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const D3 = FR.DATA.fr3, D4 = FR.DATA.fr4;

  // ---------------------------------------------------------------- sections
  const SECS = [
    { name: 'Objectives', sweep: 'Financial Readiness' },
    { name: 'Your pay', sweep: 'Your pay' },
    { name: 'My story', sweep: 'From −$20K' },
    { name: 'Your LES', sweep: 'Your first LES' },
    { name: 'The BRS', sweep: 'The BRS' },
    { name: 'Zoom out', sweep: 'Zoom out' },
    { name: 'Money calls', sweep: 'Money calls' },
  ];

  // ---------------------------------------------------------------- chapter scenes, without the steps that ask the learner to tap
  const SCENES = {
    fr1: { st: { guess: '' }, drop: ['Your guess'] },
    fr2: { st: { married: 'no' }, drop: ['Your turn'] },
    fr3: { st: { pct: 5 }, drop: ['2. The TSP: your choice', 'Every month', 'Twenty years later', 'When in doubt, zoom out', 'Zoom out: one month', 'Zoom out: one year', 'Zoom out: ten years', 'Zoom out: one hundred years'] },
    fr4: { st: { c: Object.assign({}, D4.BEST) }, keep: ['My mantra'] },
  };
  const stage = $('#stage');
  // engraved guilloche rosettes and a double gold rule, like the border of a banknote
  (function engrave() {
    const g = [];
    const rosette = (cx, cy, R, r, n, op) => {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI;
        g.push(`<ellipse cx="${cx}" cy="${cy}" rx="${R}" ry="${r}" transform="rotate(${(a * 180 / Math.PI).toFixed(2)} ${cx} ${cy})" opacity="${op}"/>`);
      }
      for (let k = 1; k <= 3; k++) g.push(`<circle cx="${cx}" cy="${cy}" r="${r * 0.35 * k}" opacity="${op * 1.4}"/>`);
    };
    rosette(1490, 800, 330, 120, 48, 0.07);
    rosette(110, 95, 190, 70, 36, 0.06);
    // fine wavy engraving along the bottom edge
    for (let k = 0; k < 7; k++) {
      let d = 'M0 ' + (868 - k * 5);
      for (let x = 0; x <= 1600; x += 20) d += ` L${x} ${(868 - k * 5 + Math.sin(x / 38 + k * 0.9) * 4).toFixed(1)}`;
      g.push(`<path d="${d}" fill="none" opacity="0.06"/>`);
    }
    const svg = `<svg class="engrave" viewBox="0 0 1600 900" width="1600" height="900" aria-hidden="true"><g fill="none" stroke="#c9a24a" stroke-width="1.4">${g.join('')}</g>
      <rect x="12" y="12" width="1576" height="876" rx="12" fill="none" stroke="#c9a24a" stroke-opacity=".32" stroke-width="2"/>
      <rect x="20" y="20" width="1560" height="860" rx="8" fill="none" stroke="#c9a24a" stroke-opacity=".14" stroke-width="1.2"/></svg>`;
    stage.insertAdjacentHTML('afterbegin', svg);
  })();
  Object.entries(SCENES).forEach(([id, d]) => {
    const sc = FR.SCENES[id](d.st);
    sc.steps = sc.steps.filter((s) => (d.keep ? d.keep.includes(s.meta.head) : !d.drop.includes(s.meta.head)));
    d.sc = sc;
    d.layer = document.createElement('div'); d.layer.className = 'layer';
    d.svg = document.createElementNS(NS, 'svg'); d.svg.setAttribute('class', 'scene');
    d.layer.appendChild(d.svg); stage.appendChild(d.layer);
  });
  const stepOf = (id, head) => SCENES[id].sc.steps.findIndex((s) => s.meta.head === head);

  // ---------------------------------------------------------------- small SVG helpers for the live slides
  function sv(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  const pathOf = (pts) => 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
  // a value that eases toward its target every frame, so a drag looks smooth
  function Smooth(v) { return { v, t: v, step(k) { this.v += (this.t - this.v) * (k || 0.16); if (Math.abs(this.t - this.v) < 1e-3 * (Math.abs(this.t) + 1)) this.v = this.t; return this.v; } }; }
  const fv = (pmt, months, r) => { const i = Math.pow(1 + r, 1 / 12) - 1; return pmt * (Math.pow(1 + i, months) - 1) / i; };

  // a big slider with its value, optional ticks and a play button that sweeps it
  function slider(host, o) {
    const box = document.createElement('div');
    box.className = 'slide-ctl in'; box.style.cssText = `left:${o.x}px;top:${o.y}px;width:${o.w}px;--d:${o.d || 0.3};--tc:${o.color || C.green}`;
    box.innerHTML = `<div class="row"><span class="lab">${o.label}</span><span class="val"></span>${o.play ? '<button type="button" class="play" title="Play it"><svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>Play</button>' : ''}</div>
      <input class="big-range" type="range" min="${o.min}" max="${o.max}" step="${o.step}" value="${o.value}" aria-label="${esc(o.label)}">
      ${o.ticks ? `<div class="ticks">${o.ticks.map(([v, t]) => `<span data-v="${v}" style="left:${(v - o.min) / (o.max - o.min) * 100}%">${t}</span>`).join('')}</div>` : ''}`;
    host.appendChild(box);
    const inp = box.querySelector('input'), val = box.querySelector('.val');
    const paint = () => {
      const v = +inp.value;
      inp.style.setProperty('--fill', ((v - o.min) / (o.max - o.min) * 100) + '%');
      val.innerHTML = o.show(v);
      box.querySelectorAll('.ticks span').forEach((s) => s.classList.toggle('on', Math.abs(+s.dataset.v - v) < (o.max - o.min) / 40));
      o.on(v);
    };
    inp.addEventListener('input', () => { stopPlay(); paint(); });
    // let go of the slider so the arrow keys and a clicker go back to changing slides
    inp.addEventListener('pointerup', () => inp.blur());
    inp.addEventListener('change', () => inp.blur());
    let raf = 0;
    const stopPlay = () => { cancelAnimationFrame(raf); raf = 0; };
    const play = (from, to, secs) => {
      stopPlay();
      const t0 = performance.now();
      const tick = (now) => {
        const p = clamp((now - t0) / (secs * 1000), 0, 1), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        inp.value = lerp(from, to, e); paint();
        if (p < 1) raf = requestAnimationFrame(tick); else raf = 0;
      };
      raf = requestAnimationFrame(tick);
    };
    if (o.play) box.querySelector('.play').addEventListener('click', (e) => { e.currentTarget.blur(); play(o.play[0], o.play[1], o.play[2]); });
    paint();
    return { set(v) { stopPlay(); inp.value = v; paint(); }, play, stop: stopPlay, get value() { return +inp.value; } };
  }
  const div = (host, cls, css, html) => { const d = document.createElement('div'); d.className = cls; if (css) d.style.cssText = css; if (html != null) d.innerHTML = html; host.appendChild(d); return d; };
  // a number that counts to its value
  function counter(node, f) {
    let cur = null, raf = 0;
    return (v, now) => {
      if (cur == null || now || reduce) { cur = v; node.textContent = f(v); return; }
      cancelAnimationFrame(raf);
      const a = cur, t0 = performance.now();
      const tick = (t) => { const p = clamp((t - t0) / 700, 0, 1), e = 1 - Math.pow(1 - p, 3); cur = lerp(a, v, e); node.textContent = f(cur); if (p < 1) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    };
  }
  // a chart frame: axes, grid lines with labels, returns x/y mappers
  function chart(svg, g) {
    const x = (v) => g.x0 + (g.x1 - g.x0) * (v - g.a) / (g.b - g.a);
    const y = (v) => g.y0 - (g.y0 - g.y1) * (v - g.lo) / (g.hi - g.lo);
    return { x, y };
  }

  // ======================================================================
  // live slides
  // ======================================================================
  const LIVE = {};

  // ---- title: my net worth line draws itself and the number counts up
  LIVE.title = {
    head: 'Financial Readiness', body: 'AFAS 3410 · Capt Scott D. Russell, Operations Flight Commander, Det 250',
    build(el) {
      el.innerHTML = `<div class="abs in" style="left:110px;top:120px;--d:.1"><div class="k">AFAS 3410 · Financial Readiness</div></div>
        <h1 class="abs in" style="left:110px;top:170px;font-size:104px;--d:.25">From <span class="r">−$20K</span><br>to <span class="g" id="tNum">$0</span></h1>
        <div class="abs in lab" style="left:114px;top:430px;font-size:30px;width:640px;--d:.5">How a broke college grad with student loans got here on the same pay as every other captain, and how you can do it faster.</div>
        <div class="abs in" style="left:114px;top:690px;display:flex;align-items:center;gap:22px;--d:.8"><img src="${FRChars.BASE}scott-russell.jpg" alt="" width="110" height="110" style="border-radius:50%;border:4px solid var(--gold);object-fit:cover">
          <div class="lab" style="font-size:26px;line-height:1.35"><b style="color:var(--ink)">Capt Scott D. Russell</b><br>Operations Flight Commander · AFROTC Det 250</div></div>`;
      const svg = sv('svg', { width: 1600, height: 900, style: 'position:absolute;left:0;top:0;pointer-events:none' });
      el.prepend(svg);
      const NW = [[2019.45, -20000], [2020, -12000], [2021, -3500], [2022, 24000], [2023, 58000], [2024, 110000], [2025, 170000], [2026, 240000], [2026.9, 290039]];
      const m = chart(svg, { x0: 820, x1: 1500, y0: 700, y1: 190, a: 2019.45, b: 2026.9, lo: -40000, hi: 300000 });
      sv('line', { x1: 820, x2: 1500, y1: m.y(0), y2: m.y(0), stroke: C.line, 'stroke-width': 3, 'stroke-dasharray': '8 10' }, svg);
      sv('text', { x: 1500, y: m.y(0) + 34, 'text-anchor': 'end', fill: C.faint, 'font-size': 22, 'font-weight': 700, 'font-family': Anim.FONT }, svg).textContent = '$0';
      const pts = NW.map(([t, v]) => [m.x(t), m.y(v)]);
      const area = sv('path', { d: pathOf(pts) + `L${pts[pts.length - 1][0]} ${m.y(0)}L${pts[0][0]} ${m.y(0)}Z`, fill: 'rgba(52,245,164,.10)', opacity: 0 }, svg);
      const ln = sv('path', { d: pathOf(pts), fill: 'none', stroke: C.green, 'stroke-width': 8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
      const dot = sv('circle', { r: 14, fill: C.green, stroke: C.bg, 'stroke-width': 5 }, svg);
      const glow = sv('circle', { r: 14, fill: 'none', stroke: C.green, 'stroke-width': 4, opacity: 0 }, svg);
      ['2019', '2026'].forEach((t, i) => { sv('text', { x: i ? 1500 : 820, y: 745, 'text-anchor': i ? 'end' : 'start', fill: C.faint, 'font-size': 24, 'font-weight': 700, 'font-family': Anim.FONT }, svg).textContent = t; });
      const L = ln.getTotalLength(), num = $('#tNum', el);
      let raf = 0;
      return {
        enter() {
          cancelAnimationFrame(raf);
          const t0 = performance.now() + 500, dur = reduce ? 1 : 2600;
          const tick = (now) => {
            const p = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 2.2);
            ln.setAttribute('stroke-dasharray', `${L * e} ${L}`);
            const q = ln.getPointAtLength(L * e); dot.setAttribute('cx', q.x); dot.setAttribute('cy', q.y);
            glow.setAttribute('cx', q.x); glow.setAttribute('cy', q.y);
            area.setAttribute('opacity', e);
            // the number follows the line
            const i = clamp(Math.floor(e * (NW.length - 1)), 0, NW.length - 2), f = e * (NW.length - 1) - i;
            const v = p >= 1 ? 290039 : lerp(NW[i][1], NW[i + 1][1], f);
            num.textContent = fmt(v, { k: true }); num.className = v < 0 ? 'r' : 'g';
            if (p < 1) raf = requestAnimationFrame(tick);
            else { glow.animate([{ r: 14, opacity: 0.9 }, { r: 60, opacity: 0 }], { duration: 1400, iterations: Infinity }); glow.setAttribute('opacity', 1); }
          };
          raf = requestAnimationFrame(tick);
        },
        leave() { cancelAnimationFrame(raf); glow.getAnimations().forEach((a) => a.cancel()); glow.setAttribute('opacity', 0); },
      };
    },
  };

  // ---- objectives and samples of behavior
  LIVE.obj = {
    head: 'What you should walk out with', body: 'This is what the Air Force says you need to be able to do by the end of today.',
    build(el) {
      el.innerHTML = `<div class="obj" style="top:60px">
        <div class="k in" style="--d:.05;margin-bottom:22px">Lesson objectives</div>
        <div class="lo">
          <div class="card in" style="--d:.15"><div class="lab c">Cognitive</div><p>Understand the significant elements of military pay, allowances, and the Blended Retirement System.</p></div>
          <div class="card in" style="--d:.3"><div class="lab v">Affective</div><p>Respond to the importance of understanding financial fitness.</p></div>
        </div>
        <div class="k in" style="--d:.45;margin-bottom:18px">Samples of behavior</div>
        <div class="sob">
          <div class="card in" style="--d:.6"><div class="n">1</div><p>Cite the importance of understanding the BRS.</p><div class="where">The BRS · Zoom out</div></div>
          <div class="card in" style="--d:.75"><div class="n">2</div><p>Identify the three types of pay.</p><div class="where">Your pay · Your LES</div></div>
          <div class="card in" style="--d:.9"><div class="n">3</div><p>React to various money management scenarios.</p><div class="where">My story · Money calls</div></div>
        </div></div>`;
      return {};
    },
  };

  // ---- lifestyle inflation: how much of the 2d Lt paycheck you live on
  LIVE.life = {
    head: 'Drag it: what do you live on?', body: 'Your first month as a 2d Lt is **$6,062.68**. Slide what you spend and watch what the rest turns into.',
    build(el) {
      const PAY = 6062.68;
      const svg = sv('svg', { width: 1600, height: 900, style: 'position:absolute;left:0;top:0' }); el.appendChild(svg);
      div(el, 'abs k in', 'left:70px;top:200px;--d:.05', 'Your first paycheck as a 2d Lt: <span class="g">$6,062.68</span> a month');
      // the paycheck bar
      const BX = 70, BW = 1460, BY = 236, BH = 84;
      sv('rect', { x: BX, y: BY, width: BW, height: BH, rx: 18, fill: C.panel2, stroke: C.line, 'stroke-width': 3 }, svg);
      const spendR = sv('rect', { x: BX, y: BY, height: BH, rx: 18, fill: C.amber }, svg);
      const bankR = sv('rect', { y: BY, height: BH, rx: 18, fill: C.green }, svg);
      const spendT = sv('text', { y: BY + 55, x: BX + 26, fill: '#1a1203', 'font-size': 34, 'font-weight': 850, 'font-family': Anim.FONT }, svg);
      const bankT = sv('text', { y: BY + 55, x: BX + BW - 26, 'text-anchor': 'end', fill: '#04140e', 'font-size': 34, 'font-weight': 850, 'font-family': Anim.FONT }, svg);
      // the growth chart: bank it for your first 4 years, then leave it alone until 60
      const G = { x0: 140, x1: 1000, y0: 800, y1: 440, a: 22, b: 60, lo: 0, hi: 2.4e6 };
      const m = chart(svg, G);
      [0, 0.5e6, 1e6, 1.5e6, 2e6].forEach((v) => {
        sv('line', { x1: G.x0, x2: G.x1, y1: m.y(v), y2: m.y(v), stroke: C.line, 'stroke-width': 2, opacity: 0.6 }, svg);
        sv('text', { x: G.x0 - 14, y: m.y(v) + 8, 'text-anchor': 'end', fill: C.faint, 'font-size': 22, 'font-weight': 700, 'font-family': Anim.FONT }, svg).textContent = v ? '$' + (v / 1e6) + 'M' : '$0';
      });
      [22, 26, 30, 40, 50, 60].forEach((a) => sv('text', { x: m.x(a), y: G.y0 + 36, 'text-anchor': 'middle', fill: C.faint, 'font-size': 22, 'font-weight': 700, 'font-family': Anim.FONT }, svg).textContent = 'Age ' + a);
      sv('line', { x1: m.x(26), x2: m.x(26), y1: G.y1 - 10, y2: G.y0, stroke: C.faint, 'stroke-width': 2, 'stroke-dasharray': '6 8' }, svg);
      sv('text', { x: m.x(26) + 12, y: G.y1 + 8, fill: C.soft, 'font-size': 21, 'font-weight': 700, 'font-family': Anim.FONT }, svg).textContent = 'Stop adding after 4 years';
      const area = sv('path', { fill: 'rgba(52,245,164,.12)' }, svg);
      const ln = sv('path', { fill: 'none', stroke: C.green, 'stroke-width': 7, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      const dot = sv('circle', { r: 12, fill: C.green }, svg);
      div(el, 'abs lab in', 'left:70px;top:350px;font-size:26px;--d:.2', 'Bank the difference for your first 4 years at 7%, then just leave it alone:');
      const s1 = div(el, 'stat in', 'left:1080px;top:400px;width:450px;--d:.35', '<div class="lab">Banked every month</div><div class="big g">$0</div>');
      const s2 = div(el, 'stat in', 'left:1080px;top:560px;width:450px;--d:.45', '<div class="lab">After your first 4 years</div><div class="big g">$0</div>');
      const s3 = div(el, 'stat in', 'left:1080px;top:720px;padding:16px 26px;width:450px;--d:.55;border-color:#1f7a5c', '<div class="lab">Left alone until you\'re 60</div><div class="big g">$0</div>');
      const c1 = counter($('.big', s1), (v) => fmt(v)), c2 = counter($('.big', s2), (v) => fmt(v, { k: true })), c3 = counter($('.big', s3), (v) => fmt(v / 1e6, { pre: '$', post: 'M' }).replace(/\$(\d+)M/, (x, n) => '$' + (v / 1e6).toFixed(2) + 'M'));
      const sm = Smooth(3000); let raf = 0, live = false;
      const draw = () => {
        const L = sm.step(0.2), bank = Math.max(0, PAY - L);
        const wS = BW * Math.min(L, PAY) / PAY;
        spendR.setAttribute('width', Math.max(0, wS)); bankR.setAttribute('x', BX + wS); bankR.setAttribute('width', Math.max(0, BW - wS));
        spendT.textContent = wS > 360 ? 'Live on ' + fmt(L) : ''; bankT.textContent = BW - wS > 300 ? 'Bank ' + fmt(bank) : '';
        const pts = []; let b = 0;
        for (let a = 22; a <= 60.001; a += 0.25) { pts.push([m.x(a), m.y(Math.min(b, G.hi * 1.02))]); for (let k = 0; k < 3; k++) b = b * Math.pow(1.07, 1 / 12) + (a < 26 ? bank : 0); }
        ln.setAttribute('d', pathOf(pts)); area.setAttribute('d', pathOf(pts) + `L${G.x1} ${G.y0}L${G.x0} ${G.y0}Z`);
        dot.setAttribute('cx', pts[pts.length - 1][0]); dot.setAttribute('cy', pts[pts.length - 1][1]);
        if (live) raf = requestAnimationFrame(draw);
      };
      const at = (L) => { const bank = Math.max(0, PAY - L), f4 = fv(bank, 48, 0.07); return { bank, f4, f60: f4 * Math.pow(1.07, 34) }; };
      const sl = slider(el, { x: 70, y: 30, w: 1460, label: 'What you live on each month', min: 1500, max: 6000, step: 50, value: 3000, color: C.amber, d: 0.15,
        ticks: [[1500, '$1,500'], [3000, 'About what a cadet lives on'], [4500, '$4,500'], [6000, 'Spend it all']], play: [6000, 2000, 3.5],
        show: (v) => `<span class="a">${fmt(v)}</span>`, on: (v) => { sm.t = v; const r = at(v); c1(r.bank); c2(r.f4); c3(r.f60); } });
      return {
        enter() { live = true; sl.set(3000); raf = requestAnimationFrame(draw); setTimeout(() => live && sl.play(3000, 4800, 1.6), reduce ? 0 : 1200); setTimeout(() => live && sl.play(4800, 3000, 1.4), reduce ? 0 : 3400); },
        leave() { live = false; cancelAnimationFrame(raf); sl.stop(); },
        replay() { this.leave(); this.enter(); },
      };
    },
  };

  // ---- start now vs wait
  LIVE.wait = {
    head: 'Drag it: what does waiting cost?', body: 'Same amount every month until you\'re 60. The only difference is **when you start.**',
    build(el) {
      const svg = sv('svg', { width: 1600, height: 900, style: 'position:absolute;left:0;top:0' }); el.appendChild(svg);
      const G = { x0: 150, x1: 1040, y0: 800, y1: 300, a: 22, b: 60, lo: 0, hi: 2e6 };
      const m = chart(svg, G);
      const grid = sv('g', {}, svg);
      [22, 30, 40, 50, 60].forEach((a) => sv('text', { x: m.x(a), y: G.y0 + 36, 'text-anchor': 'middle', fill: C.faint, 'font-size': 22, 'font-weight': 700, 'font-family': Anim.FONT }, svg).textContent = 'Age ' + a);
      const areaA = sv('path', { fill: 'rgba(52,245,164,.10)' }, svg), areaB = sv('path', { fill: 'rgba(251,90,114,.12)' }, svg);
      const lnA = sv('path', { fill: 'none', stroke: C.green, 'stroke-width': 7, 'stroke-linejoin': 'round' }, svg);
      const lnB = sv('path', { fill: 'none', stroke: C.red, 'stroke-width': 7, 'stroke-linejoin': 'round', 'stroke-dasharray': '2 0' }, svg);
      const gap = sv('line', { stroke: C.amber, 'stroke-width': 4, 'stroke-dasharray': '6 8' }, svg);
      const lab = (fill) => sv('text', { fill, 'font-size': 26, 'font-weight': 850, 'font-family': Anim.FONT }, svg);
      const tA = lab(C.green), tB = lab(C.red);
      const s1 = div(el, 'stat in', 'left:1110px;top:300px;width:430px;--d:.3', '<div class="lab">Start at 22</div><div class="big g">$0</div>');
      const s2 = div(el, 'stat in', 'left:1110px;top:470px;width:430px;--d:.4', '<div class="lab" id="wLab">Wait 3 years</div><div class="big r">$0</div>');
      const s3 = div(el, 'stat in', 'left:1110px;top:640px;width:430px;--d:.5;border-color:#7a5a12', '<div class="lab">What waiting cost you</div><div class="big a">$0</div><div class="lab" style="margin:10px 0 0;font-size:19px" id="wSkip"></div>');
      const cA = counter($('.big', s1), (v) => fmt(v, { k: true })), cB = counter($('.big', s2), (v) => fmt(v, { k: true })), cG = counter($('.big', s3), (v) => fmt(v, { k: true }));
      const st = { mo: Smooth(500), w: Smooth(3), hi: Smooth(1.2e6) };
      let raf = 0, live = false, gridKey = '';
      const run = (mo, w) => { const pts = []; let b = 0; for (let mth = 0; mth <= 456; mth++) { if (mth % 3 === 0) pts.push([22 + mth / 12, b]); b = b * Math.pow(1.07, 1 / 12) + (mth >= w * 12 ? mo : 0); } return pts; };
      const draw = () => {
        const mo = st.mo.step(0.2), w = st.w.step(0.2);
        const A = run(mo, 0), B = run(mo, w);
        st.hi.t = A[A.length - 1][1] * 1.12; G.hi = st.hi.step(0.12);
        const step = G.hi > 3e6 ? 1e6 : G.hi > 1.2e6 ? 5e5 : G.hi > 6e5 ? 2e5 : 1e5, key = step + ':' + Math.floor(G.hi / step);
        if (key !== gridKey) { gridKey = key; grid.innerHTML = ''; for (let v = 0; v <= G.hi; v += step) { sv('line', { x1: G.x0, x2: G.x1, y1: m.y(v), y2: m.y(v), stroke: C.line, 'stroke-width': 2, opacity: 0.6 }, grid); sv('text', { x: G.x0 - 14, y: m.y(v) + 8, 'text-anchor': 'end', fill: C.faint, 'font-size': 22, 'font-weight': 700, 'font-family': Anim.FONT }, grid).textContent = v >= 1e6 ? '$' + (v / 1e6) + 'M' : fmt(v, { k: true }); } }
        else grid.querySelectorAll('line').forEach((l, i) => { l.setAttribute('y1', m.y(i * step)); l.setAttribute('y2', m.y(i * step)); }), grid.querySelectorAll('text').forEach((t, i) => t.setAttribute('y', m.y(i * step) + 8));
        const pa = A.map(([a, v]) => [m.x(a), m.y(v)]), pb = B.map(([a, v]) => [m.x(a), m.y(v)]);
        lnA.setAttribute('d', pathOf(pa)); lnB.setAttribute('d', pathOf(pb));
        areaA.setAttribute('d', pathOf(pa) + `L${G.x1} ${G.y0}L${G.x0} ${G.y0}Z`); areaB.setAttribute('d', pathOf(pb) + `L${G.x1} ${G.y0}L${G.x0} ${G.y0}Z`);
        const ea = pa[pa.length - 1], eb = pb[pb.length - 1];
        gap.setAttribute('x1', ea[0] + 24); gap.setAttribute('x2', ea[0] + 24); gap.setAttribute('y1', ea[1]); gap.setAttribute('y2', eb[1]);
        tA.setAttribute('x', ea[0] - 10); tA.setAttribute('y', ea[1] - 18); tA.setAttribute('text-anchor', 'end'); tA.textContent = 'Start now';
        tB.setAttribute('x', eb[0] - 10); tB.setAttribute('y', Math.max(eb[1] + 38, ea[1] + 40)); tB.setAttribute('text-anchor', 'end'); tB.textContent = w >= 0.05 ? 'Wait ' + Math.round(w) + (Math.round(w) === 1 ? ' year' : ' years') : '';
        if (live) raf = requestAnimationFrame(draw);
      };
      const nums = () => {
        const mo = sMo.value, w = sW.value, A = run(mo, 0), B = run(mo, w), a = A[A.length - 1][1], b = B[B.length - 1][1];
        cA(a); cB(b); cG(a - b);
        $('#wLab', el).textContent = w ? `Wait ${w} ${w === 1 ? 'year' : 'years'}` : 'Start at 22 too';
        $('#wSkip', el).textContent = w ? `You only skipped ${fmt(mo * 12 * w, { k: true })} of deposits.` : 'No wait, no cost.';
      };
      let sMo = { value: 500 }, sW = { value: 3 };
      sMo = slider(el, { x: 70, y: 40, w: 720, label: 'Invest each month', min: 100, max: 2000, step: 50, value: 500, d: 0.1,
        show: (v) => `<span class="g">${fmt(v)}</span>`, on: (v) => { st.mo.t = v; nums(); } });
      sW = slider(el, { x: 820, y: 40, w: 710, label: 'Years you wait to start', min: 0, max: 10, step: 1, value: 3, color: C.red, d: 0.2, play: [0, 10, 4],
        ticks: [[0, 'Day 1'], [2, '2'], [4, '4'], [6, '6'], [8, '8'], [10, '10']],
        show: (v) => `<span class="r">${v}</span>`, on: (v) => { st.w.t = v; nums(); } });
      nums();
      return {
        enter() { live = true; sMo.set(500); sW.set(0); raf = requestAnimationFrame(draw); setTimeout(() => live && sW.play(0, 5, 2.2), reduce ? 0 : 900); },
        leave() { live = false; cancelAnimationFrame(raf); sW.stop(); },
        replay() { this.leave(); this.enter(); },
      };
    },
  };

  // ---- the TSP: how much you put in, what the Air Force adds, what 20 years turns it into
  LIVE.tsp = {
    head: 'Drag it: your TSP contribution', body: 'The Air Force puts in **1%** no matter what. Once you hit 2 years, they **match you up to 4% more**, but only if you put in 5%.',
    build(el) {
      const BASE = 4150.20, MAXP = 15;
      const svg = sv('svg', { width: 1600, height: 900, style: 'position:absolute;left:0;top:0' }); el.appendChild(svg);
      const AT = []; for (let x = 0; x <= MAXP; x++) AT.push(D3.at20(x));
      // left: a stack of money per month. you (cyan) on the bottom, the Air Force (green) on top, the match you skip (red outline)
      const SX = 150, SW = 260, SY = 780, K = 0.55;   // px per dollar
      div(el, 'abs k in', 'left:120px;top:236px;--d:.15', 'Every month, base pay ' + fmt(BASE, { cents: true }));
      const youR = sv('rect', { x: SX, width: SW, rx: 14, fill: C.cyan }, svg);
      const govR = sv('rect', { x: SX, width: SW, rx: 14, fill: C.green }, svg);
      const lostR = sv('rect', { x: SX, width: SW, rx: 14, fill: 'rgba(251,90,114,.12)', stroke: C.red, 'stroke-width': 4, 'stroke-dasharray': '12 10' }, svg);
      const tYou = sv('text', { x: SX + SW + 26, fill: C.cyan, 'font-size': 30, 'font-weight': 850, 'font-family': Anim.FONT }, svg);
      const tGov = sv('text', { x: SX + SW + 26, fill: C.green, 'font-size': 30, 'font-weight': 850, 'font-family': Anim.FONT }, svg);
      const tLost = sv('text', { x: SX + SW + 26, fill: C.red, 'font-size': 30, 'font-weight': 850, 'font-family': Anim.FONT }, svg);
      sv('line', { x1: SX - 30, x2: SX + SW + 30, y1: SY, y2: SY, stroke: C.line, 'stroke-width': 4 }, svg);
      // right: what each choice is worth after 20 years
      const RX = 820, RW = 720, RY = 800, RH = 440;
      div(el, 'abs k in', `left:${RX}px;top:236px;--d:.25`, 'Your TSP after 20 years');
      const bars = AT.map((v, x) => {
        const w = RW / AT.length - 8, bx = RX + x * (RW / AT.length);
        const r = sv('rect', { x: bx, width: w, rx: 6, fill: C.panel2, stroke: C.line, 'stroke-width': 2 }, svg);
        sv('text', { x: bx + w / 2, y: RY + 30, 'text-anchor': 'middle', fill: C.faint, 'font-size': 19, 'font-weight': 700, 'font-family': Anim.FONT }, svg).textContent = x % 5 === 0 ? x + '%' : '';
        return { r, h: RH * v / AT[MAXP], bx, w };
      });
      const big = div(el, 'abs in', `left:${RX}px;top:280px;--d:.35`, '<span class="big g">$0</span>');
      const note = div(el, 'abs lab in', `left:${RX}px;top:372px;width:720px;--d:.45`, '');
      const cBig = counter($('.big', big), (v) => fmt(v, { k: true }));
      const sm = Smooth(0); let raf = 0, live = false, grow = 0;
      const draw = () => {
        const x = sm.step(0.18), gov = D3.govPct(x, 3), lost = Math.max(0, 5 - gov) - Math.max(0, 5 - x) * 0 ; // the match left behind
        const yH = BASE * x / 100 * K, gH = BASE * gov / 100 * K, lH = BASE * Math.max(0, 5 - gov) / 100 * K;
        youR.setAttribute('y', SY - yH); youR.setAttribute('height', Math.max(0, yH));
        govR.setAttribute('y', SY - yH - gH - 4); govR.setAttribute('height', gH);
        lostR.setAttribute('y', SY - yH - gH - lH - 8); lostR.setAttribute('height', Math.max(0, lH)); lostR.setAttribute('opacity', lH > 2 ? 1 : 0);
        tYou.setAttribute('y', yH > 30 ? SY - yH / 2 + 10 : SY + 44); tYou.textContent = x > 0.3 ? `You: ${fmt(BASE * x / 100)}` : 'You: $0';
        tGov.setAttribute('y', SY - yH - gH / 2 + 6); tGov.textContent = `Air Force: ${fmt(BASE * gov / 100)}`;
        tLost.setAttribute('y', SY - yH - gH - lH / 2 - 2); tLost.textContent = lH > 2 ? `Left on the table: ${fmt(BASE * (5 - gov) / 100)}` : '';
        grow = Math.min(1, grow + 0.04);
        bars.forEach((b, i) => {
          const on = Math.abs(i - x) < 0.5, h = b.h * (1 - Math.pow(1 - grow, 3));
          b.r.setAttribute('y', RY - h); b.r.setAttribute('height', h);
          b.r.setAttribute('fill', on ? (i >= 5 ? C.green : C.red) : i >= 5 ? '#123a2e' : C.panel2);
          b.r.setAttribute('stroke', on ? C.ink : C.line);
        });
        if (live) raf = requestAnimationFrame(draw);
      };
      const sl = slider(el, { x: 70, y: 40, w: 1460, label: 'You put in (% of base pay)', min: 0, max: MAXP, step: 1, value: 0, color: C.cyan, d: 0.1, play: [0, 5, 2.2],
        ticks: [[0, '0%'], [1, '1%'], [3, '3%'], [5, '5%: the whole match'], [10, '10%'], [15, '15%']],
        show: (v) => `<span class="c">${v}%</span> <span class="s" style="font-size:28px">+ Air Force ${D3.govPct(v, 3)}%</span>`,
        on: (v) => { sm.t = v; cBig(AT[v]); note.innerHTML = v >= 5 ? `You're getting every dollar of the match.${v > 5 ? ` The extra ${v - 5}% is all you, and it adds up.` : ''}` : `Bump it to 5% and you'd have <b class="g">${fmt(AT[5] - AT[v], { k: true })}</b> more. Same career, same pay.`; } });
      return {
        enter() { live = true; grow = 0; sl.set(0); raf = requestAnimationFrame(draw); setTimeout(() => live && sl.play(0, 5, 2.4), reduce ? 0 : 1300); },
        leave() { live = false; cancelAnimationFrame(raf); sl.stop(); },
        replay() { this.leave(); this.enter(); },
      };
    },
  };

  // ---- when in doubt, zoom out: one chart that morphs from a day to a hundred years
  LIVE.zoom = {
    head: 'When in doubt, zoom out', body: 'The C Fund tracks the S&P 500. **Drag from one day out to a hundred years** and watch the "sell-off" disappear.',
    build(el) {
      const Z = D3.ZOOMS, N = 160;
      const norm = Z.map((z) => {
        const ys = z.pts.map((p) => (z.log ? Math.log(p[1]) : p[1])), lo = Math.min(...ys), hi = Math.max(...ys);
        const out = [];
        for (let i = 0; i < N; i++) {
          const t = i / (N - 1); let j = 0;
          while (j < z.pts.length - 2 && z.pts[j + 1][0] < t) j++;
          const a = z.pts[j], b = z.pts[j + 1], f = clamp((t - a[0]) / Math.max(1e-9, b[0] - a[0]), 0, 1);
          const v = lerp(z.log ? Math.log(a[1]) : a[1], z.log ? Math.log(b[1]) : b[1], f);
          out.push((v - lo) / (hi - lo || 1));
        }
        const first = z.pts[0][1], last = z.pts[z.pts.length - 1][1];
        return { pts: out, chg: (last / first - 1) * 100, lo: Math.min(...z.pts.map((p) => p[1])), hi: Math.max(...z.pts.map((p) => p[1])) };
      });
      const svg = sv('svg', { width: 1600, height: 900, style: 'position:absolute;left:0;top:0' }); el.appendChild(svg);
      const X0 = 200, X1 = 1180, Y0 = 790, Y1 = 260;
      for (let i = 0; i <= 4; i++) sv('line', { x1: X0, x2: X1, y1: lerp(Y0, Y1, i / 4), y2: lerp(Y0, Y1, i / 4), stroke: C.line, 'stroke-width': 2, opacity: 0.6 }, svg);
      const area = sv('path', {}, svg), ln = sv('path', { fill: 'none', 'stroke-width': 7, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      const dot = sv('circle', { r: 13 }, svg), ring = sv('circle', { r: 13, fill: 'none', 'stroke-width': 4 }, svg);
      const tHi = sv('text', { x: X0 - 16, y: Y1 + 8, 'text-anchor': 'end', fill: C.faint, 'font-size': 22, 'font-weight': 700, 'font-family': Anim.FONT }, svg);
      const tLo = sv('text', { x: X0 - 16, y: Y0 + 8, 'text-anchor': 'end', fill: C.faint, 'font-size': 22, 'font-weight': 700, 'font-family': Anim.FONT }, svg);
      const tWhen = sv('text', { x: X0, y: Y0 + 44, fill: C.soft, 'font-size': 24, 'font-weight': 700, 'font-family': Anim.FONT }, svg);
      const tLog = sv('text', { x: X1, y: Y0 + 44, 'text-anchor': 'end', fill: C.faint, 'font-size': 20, 'font-weight': 700, 'font-family': Anim.FONT }, svg);
      const big = div(el, 'stat in', 'left:1240px;top:260px;width:300px;--d:.3', '<div class="lab">Over this window</div><div class="big">0%</div>');
      const say = div(el, 'card in', 'left:1240px;top:450px;width:300px;--d:.45', '<div class="lab s">What the news says</div><p></p>');
      const SAY = ['"Stocks tumble!"', '"Rough month for markets."', '"A solid year."', '"Wow, more than triple."', '"Through a depression, a world war, 2008 and COVID."'];
      const sm = Smooth(0); let raf = 0, live = false, lastK = -1;
      const draw = () => {
        const z = sm.step(0.14), k = Math.min(3, Math.floor(z)), f = z - k, A = norm[k], B = norm[Math.min(4, k + 1)];
        const pts = A.pts.map((v, i) => [lerp(X0, X1, i / (N - 1)), lerp(Y0, Y1, lerp(v, B.pts[i], f) * 0.9 + 0.05)]);
        const near = Math.round(z), Zn = norm[near], up = Zn.chg >= 0, col = up ? C.green : C.red;
        ln.setAttribute('d', pathOf(pts)); ln.setAttribute('stroke', col);
        area.setAttribute('d', pathOf(pts) + `L${X1} ${Y0}L${X0} ${Y0}Z`); area.setAttribute('fill', up ? 'rgba(52,245,164,.10)' : 'rgba(251,90,114,.12)');
        const e = pts[pts.length - 1]; dot.setAttribute('cx', e[0]); dot.setAttribute('cy', e[1]); dot.setAttribute('fill', col);
        ring.setAttribute('cx', e[0]); ring.setAttribute('cy', e[1]); ring.setAttribute('stroke', col);
        if (near !== lastK) {
          lastK = near;
          tHi.textContent = fmt(Zn.hi, { pre: '' }); tLo.textContent = fmt(Zn.lo, { pre: '' });
          tWhen.textContent = Z[near].name + ': ' + Z[near].when; tLog.textContent = Z[near].log ? 'log scale' : '';
          const b = $('.big', big); b.className = 'big ' + (up ? 'g' : 'r');
          b.textContent = (up ? '+' : '−') + Math.abs(Zn.chg).toLocaleString('en-US', { maximumFractionDigits: Math.abs(Zn.chg) < 10 ? 1 : 0 }) + '%';
          $('p', say).textContent = SAY[near]; say.classList.remove('flash'); void say.offsetWidth; say.classList.add('flash');
        }
        if (live) raf = requestAnimationFrame(draw);
      };
      const sl = slider(el, { x: 70, y: 40, w: 1460, label: 'Zoom out', min: 0, max: 4, step: 0.01, value: 0, d: 0.1, play: [0, 4, 6],
        ticks: Z.map((z, i) => [i, z.name]),
        show: (v) => `<span class="g">${Z[Math.round(v)].name}</span>`, on: (v) => { sm.t = v; } });
      return {
        enter() { live = true; lastK = -1; sl.set(0); sm.v = 0; raf = requestAnimationFrame(draw); ring.animate([{ r: 13, opacity: 0.9 }, { r: 48, opacity: 0 }], { duration: 1400, iterations: Infinity }); },
        leave() { live = false; cancelAnimationFrame(raf); sl.stop(); ring.getAnimations().forEach((a) => a.cancel()); },
        replay() { this.leave(); this.enter(); },
      };
    },
  };

  // ---- money calls: five choices, one line that moves as you change them
  LIVE.calls = {
    head: 'Money calls', body: 'Five decisions you\'re going to face in your first ten years. **Flip them and watch the line move.**',
    build(el) {
      const svg = sv('svg', { width: 1600, height: 900, style: 'position:absolute;left:0;top:0;pointer-events:none' }); el.appendChild(svg);
      const G = { x0: 800, x1: 1520, y0: 560, y1: 110, lo: -60000, hi: 420000 };
      const px = (t) => G.x0 + (G.x1 - G.x0) * t / 10, py = (v) => G.y0 - (G.y0 - G.y1) * (v - G.lo) / (G.hi - G.lo);
      [0, 100000, 200000, 300000, 400000].forEach((v) => { sv('line', { x1: G.x0, x2: G.x1, y1: py(v), y2: py(v), stroke: C.line, 'stroke-width': v ? 2 : 3, opacity: v ? 0.6 : 1 }, svg); sv('text', { x: G.x0 - 12, y: py(v) + 8, 'text-anchor': 'end', fill: C.faint, 'font-size': 20, 'font-weight': 700, 'font-family': Anim.FONT }, svg).textContent = fmt(v, { k: true }); });
      [0, 2, 4, 6, 8, 10].forEach((t) => sv('text', { x: px(t), y: G.y0 + 32, 'text-anchor': 'middle', fill: C.faint, 'font-size': 20, 'font-weight': 700, 'font-family': Anim.FONT }, svg).textContent = 'Year ' + t);
      const line = (pts, attrs) => sv('path', Object.assign({ d: pathOf(pts.map(([t, v]) => [px(t), py(v)])), fill: 'none', 'stroke-width': 5, 'stroke-linejoin': 'round' }, attrs), svg);
      const EASYP = D4.sim(D4.EASY);
      line(EASYP, { stroke: C.red, 'stroke-dasharray': '10 10', opacity: 0.8 });
      line(D4.MINE, { stroke: C.amber });
      const you = sv('path', { fill: 'none', stroke: C.green, 'stroke-width': 8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      const youDot = sv('circle', { r: 12, fill: C.green }, svg);
      const keyT = (y, col, t) => { sv('rect', { x: G.x0 + 10, y: y - 16, width: 28, height: 6, rx: 3, fill: col }, svg); sv('text', { x: G.x0 + 48, y: y - 6, fill: C.soft, 'font-size': 20, 'font-weight': 700, 'font-family': Anim.FONT }, svg).textContent = t; };
      keyT(G.y1 + 10, C.green, 'You'); keyT(G.y1 + 40, C.amber, 'Me, for real (started $24,920 in debt)'); keyT(G.y1 + 70, C.red, 'The easy calls');
      const end = div(el, 'stat in', 'left:800px;top:622px;width:330px;--d:.4', '<div class="lab">You at year 10</div><div class="big g">$0</div>');
      const card = div(el, 'card in', 'left:1150px;top:622px;width:400px;--d:.5;padding:16px 20px', '<div class="lab v" id="cBook"></div><p id="cIdea" style="font-size:21px"></p><div class="lab a" style="margin:12px 0 4px">What I did</div><p id="cMe" style="font-size:19px;color:var(--soft)"></p>');
      const cEnd = counter($('.big', end), (v) => fmt(v, { k: true }));
      const box = div(el, 'calls', '');
      const pick = Object.assign({}, D4.EASY);
      const tone = (k, v) => { const o = D4.CALLS.find((c) => c.key === k).opts.map((q) => q[0]); const i = o.indexOf(v); return i === o.length - 1 ? '' : i === 0 ? 'bad' : 'mid'; };
      D4.CALLS.forEach((c, i) => {
        const row = div(box, 'call in', `--d:${0.15 + i * 0.08}`, `<div class="t"><small>${c.title.split(':')[0]}</small>${esc(c.ask)}</div><div class="seg">${c.opts.map((o) => `<button type="button" data-k="${c.key}" data-v="${o[0]}" title="${esc(o[2])}">${esc(o[1])}</button>`).join('')}</div>`);
        row.dataset.k = c.key;
      });
      const btns = div(el, 'abs in', 'left:40px;top:812px;display:flex;gap:12px;--d:.6', '<button type="button" class="pillbtn" data-all="easy">All the easy calls</button><button type="button" class="pillbtn" data-all="best">All the best calls</button>');
      const cur = EASYP.map((p) => p.slice());
      let target = EASYP, raf = 0, live = false;
      const show = (k) => {
        const c = D4.CALLS.find((q) => q.key === k);
        $('#cBook', card).textContent = c.book; $('#cIdea', card).textContent = c.idea; $('#cMe', card).textContent = c.me;
        card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
        box.querySelectorAll('.call').forEach((r) => r.classList.toggle('hot', r.dataset.k === k));
      };
      const paint = () => {
        box.querySelectorAll('.seg button').forEach((b) => { const k = b.dataset.k, v = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v, on = pick[k] === v; b.className = on ? 'on ' + tone(k, v) : ''; });
        target = D4.sim(pick); cEnd(target[target.length - 1][1]);
      };
      box.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return; b.blur();
        pick[b.dataset.k] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; paint(); show(b.dataset.k);
      });
      btns.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return; b.blur();
        Object.assign(pick, b.dataset.all === 'best' ? D4.BEST : D4.EASY); paint(); show('raise');
      });
      const draw = () => {
        cur.forEach((p, i) => { p[1] += (target[i][1] - p[1]) * (0.08 + 0.004 * i); });
        you.setAttribute('d', pathOf(cur.map(([t, v]) => [px(t), py(v)])));
        const e = cur[cur.length - 1]; youDot.setAttribute('cx', px(e[0])); youDot.setAttribute('cy', py(e[1]));
        if (live) raf = requestAnimationFrame(draw);
      };
      paint(); show('tsp');
      return {
        enter() { live = true; raf = requestAnimationFrame(draw); },
        leave() { live = false; cancelAnimationFrame(raf); },
        replay() { Object.assign(pick, D4.EASY); cur.forEach((p, i) => { p[1] = 0; }); paint(); show('tsp'); },
      };
    },
  };

  // ---- close: the three samples of behavior, checked off
  LIVE.close = {
    head: 'Questions?', body: 'If you only remember one thing: **put in at least 5% on day 1 and live like a cadet for a while.** You\'ll thank yourself later.',
    build(el) {
      el.innerHTML = `<div class="obj" style="top:110px">
        <div class="k in" style="--d:.05;margin-bottom:26px">What we covered</div>
        <div class="sob">
          ${[['The BRS', 'A smaller pension, the TSP match and continuation pay. The match is free money, so take all of it.'],
             ['Three types of pay', 'Base pay (taxed), allowances like BAH and BAS (not taxed), and special and incentive pay.'],
             ['Money calls', 'Cars, emergencies, a spouse, promotions. Keep the big things small and bank the raises.']].map(([t, p], i) => `
          <div class="card in" style="--d:${0.2 + i * 0.25}"><div class="n g" style="color:var(--green)">✓</div><p style="font-weight:850">${t}</p><p style="font-size:22px;color:var(--soft);font-weight:600">${p}</p></div>`).join('')}
        </div>
        <h1 class="in" style="--d:1;margin-top:70px;font-size:88px">Questions?</h1>
        <div class="lab in" style="--d:1.15;margin-top:14px;font-size:26px">Every chapter is on my portfolio if you want to go back through it at your own pace.</div></div>`;
      return {};
    },
  };

  // ======================================================================
  // the live room: cadets' phones (../join/), questions, the scoreboard
  // ======================================================================
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const ROOM = (function () {
    let code = store.get('fr-room-code');
    if (!code) { code = Array.from({ length: 4 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ'[Math.floor(Math.random() * 23)]).join(''); store.set('fr-room-code', code); }
    // players and scores survive a reload of the deck; the scoreboard reset button on the join slide clears them
    const R = { code, players: store.get('fr-players-v1') || {}, q: null, phase: null, opened: 0, revealed: store.get('fr-revealed-v1') || {}, status: 'off', listeners: [] };
    const save = () => { store.set('fr-players-v1', R.players); store.set('fr-revealed-v1', R.revealed); };
    const taken = () => Object.values(R.players).map((p) => p.char).filter(Boolean);
    R.changed = () => R.listeners.forEach((f) => f());
    R.joinUrl = () => location.href.split('#')[0].split('?')[0].replace(/slides\/(index\.html)?$/, 'join/') + '?room=' + code + (FRNet.local() && /local=1/.test(location.search) ? '&local=1' : '');
    function view(cid) {
      const p = R.players[cid] || {}, q = R.q, a = q && p.ans && p.ans[q.qid];
      const st = { t: 'state', taken: taken().filter((c) => c !== p.char), me: { char: p.char || null, name: p.name || '', score: p.score || 0 }, phase: R.phase };
      if (q) {
        st.q = { qid: q.qid, type: q.type, prompt: q.prompt, info: q.info, opts: q.opts, min: q.min, max: q.max, step: q.step, unit: q.unit, start: q.start, calls: q.calls };
        st.mine = a ? a.v : null; st.mineText = a ? q.say(a.v) : '';
        if (R.phase === 'reveal') st.res = a ? { pts: a.pts || 0, ok: a.pts > 0, text: q.answerText } : { pts: 0, ok: false, text: 'No answer this time. ' + q.answerText };
      }
      return st;
    }
    R.push = () => { if (R.net) Object.keys(R.players).forEach((cid) => R.net.send(cid, view(cid))); };
    R.start = () => {
      if (R.net) return;
      R.net = FRNet.host(code, {
        onStatus(s) { R.status = s; R.changed(); },
        onOpen() { R.push(); },
        onMsg(cid, m) {
          if (!m || !m.t) return;
          const p = R.players[cid] || (R.players[cid] = { score: 0, ans: {} });
          if (m.t === 'pick') {
            const c = FRChars.get(m.char);
            if (c && !taken().includes(m.char)) { p.char = m.char; p.name = c.kind === 'guest' ? String(m.name || 'Guest').slice(0, 24) : c.name; p.joined = Date.now(); save(); R.changed(); }
          }
          if (m.t === 'ans' && R.q && R.phase === 'open' && m.qid === R.q.qid && p.char && !p.ans[m.qid]) {
            p.ans[m.qid] = { v: m.v, t: (performance.now() - R.opened) / 1000 }; save(); R.changed();
          }
          R.net.send(cid, view(cid));
        },
      });
    };
    R.open = (q) => {
      R.q = q;
      if (R.revealed[q.qid]) R.phase = 'reveal';
      else { R.phase = 'open'; R.opened = performance.now(); }
      R.push(); R.changed();
    };
    R.close = () => { R.q = null; R.phase = null; R.push(); R.changed(); };
    R.reveal = () => {
      const q = R.q; if (!q || R.phase !== 'open') return;
      Object.values(R.players).forEach((p) => { const a = p.ans && p.ans[q.qid]; if (a) { a.pts = q.score(a.v, a.t); p.score = (p.score || 0) + a.pts; } });
      R.revealed[q.qid] = 1; R.phase = 'reveal'; save(); R.push(); R.changed();
    };
    R.reset = () => { R.players = {}; R.revealed = {}; save(); R.push(); R.changed(); };
    R.list = () => Object.entries(R.players).filter(([, p]) => p.char).map(([cid, p]) => Object.assign({ cid }, p));
    return R;
  })();
  const face = (p, px) => `<img class="pxf" src="${FRChars.src(p.char)}" alt="" width="${px}" height="${px}" title="${esc(p.name)}">`;
  const insig = (r, h) => `<i class="ins" style="height:${h}px;width:${h * r.ar}px;background-image:url('${r.file}')"></i>`;

  // the room badge in the top bar
  const badge = document.createElement('span'); badge.id = 'roomBadge';
  $('.ctl').prepend(badge);
  const paintBadge = () => { const n = ROOM.list().length; badge.innerHTML = `<i class="${ROOM.status}"></i>Room <b>${ROOM.code}</b> · ${n} joined`; };
  ROOM.listeners.push(paintBadge); paintBadge();

  // ---- join: QR code, room code and everyone who has joined
  LIVE.join = {
    head: 'Get your phones out', body: 'Scan the code or go to the link, then **pick yourself**. Faster right answers score more, and you get promoted as you go.',
    build(el) {
      ROOM.start();
      let qr = '';
      try { const g = qrcode(0, 'M'); g.addData(ROOM.joinUrl()); g.make(); qr = g.createSvgTag({ cellSize: 8, margin: 2, scalable: true }); } catch (e) { qr = '<div class="lab">QR code needs the internet</div>'; }
      el.innerHTML = `<div class="abs in qrbox" style="left:80px;top:90px;--d:.1">${qr}</div>
        <div class="abs in" style="left:560px;top:96px;--d:.2"><div class="k">Room code</div><div class="code">${ROOM.code}</div>
          <div class="lab" style="font-size:24px;margin-top:8px">${esc(ROOM.joinUrl().replace(/^https?:\/\//, '').replace(/\?.*$/, ''))}</div></div>
        <div class="abs in" style="left:560px;top:330px;width:980px;--d:.35"><div class="k" id="jn">Joined: 0</div><div class="crew" id="crew"></div></div>
        <button type="button" class="abs pillbtn in" id="rst" style="left:80px;top:800px;--d:.5;font-size:16px;padding:8px 16px">Reset scores</button>`;
      const crew = $('#crew', el), seen = new Set();
      const paint = () => {
        const L = ROOM.list().sort((a, b) => a.joined - b.joined);
        $('#jn', el).textContent = `Joined: ${L.length}`;
        crew.innerHTML = L.map((p) => `<div class="mate${seen.has(p.cid) ? '' : ' new'}">${face(p, 88)}<span>${esc(p.name)}</span></div>`).join('');
        L.forEach((p) => seen.add(p.cid));
      };
      let armed = 0;
      $('#rst', el).onclick = (e) => { e.currentTarget.blur(); if (Date.now() - armed < 3000) { ROOM.reset(); e.currentTarget.textContent = 'Scores cleared'; } else { armed = Date.now(); e.currentTarget.textContent = 'Press again to clear'; } };
      ROOM.listeners.push(() => { if (el.isConnected) paint(); });
      return { enter: paint };
    },
  };

  // ---- the questions. Scoring (Captain Russell, 24 Nov 2026): right answers score more the faster they come in,
  // sliders by how close, the money calls by how high the line ends.
  const choiceScore = (ans) => (v, t) => (v === ans ? 500 + Math.round(500 * clamp(1 - t / 25, 0, 1)) : 0);
  const sliderScore = (ans, tol) => (v) => Math.round(1000 * clamp(1 - Math.abs(v - ans) / tol, 0, 1));
  const CALL_V10 = (pick) => { const p = D4.sim(pick); return p[p.length - 1][1]; };
  const V_EASY = CALL_V10(D4.EASY), V_BEST = CALL_V10(D4.BEST);
  const fixPick = (v) => { const o = {}; D4.CALLS.forEach((c) => { const raw = v && v[c.key]; const hit = c.opts.find((q) => String(q[0]) === String(raw)); o[c.key] = hit ? hit[0] : D4.EASY[c.key]; }); return o; };
  const QS = {
    post: { type: 'choice', prompt: 'Your discussion post: what does a single 2d Lt in San Antonio make a month?', info: 'Base pay + BAH + BAS, 2026 rates.',
      opts: ['$4,150.20', '$6,062.68', '$7,601.20', '$5,195.32'], ans: 1, why: 'Base pay $4,150.20 + BAH $1,584 + BAS $328.48.' },
    captain: { type: 'choice', prompt: 'A captain at 4 years makes about **$9,718 a month**. Who in the enlisted force makes about the same?', info: 'Base pay + BAH + BAS, no dependents, San Antonio.',
      opts: ['An E-4 at 4 years', 'An E-5 at 8 years', 'An E-8 (SMSgt) at 20 years', 'An E-3 at 2 years'], ans: 2, why: 'A senior master sergeant at 20 years makes about $9,391. You get there in 4.' },
    life: { type: 'slider', prompt: 'You live on $3,000 and bank **$3,063 a month** for your first 4 years at 7%. Then you stop. What\'s it worth when you\'re 60?',
      min: 0, max: 3000000, step: 50000, unit: '$M', start: 500000, ans: 1690000, tol: 1300000, why: 'About $1.7 million, from just 4 years of banking the raise.' },
    taxed: { type: 'choice', prompt: 'Which of these is **taxed**?', opts: ['BAH (housing)', 'BAS (food)', 'Base pay', 'All three'], ans: 2, why: 'Only base pay. Allowances like BAH and BAS aren\'t taxed.' },
    allot: { type: 'choice', prompt: 'What\'s an **allotment** on your LES?', opts: ['A bonus for a hard assignment', 'Money sent out before your pay hits the bank', 'The tax taken from base pay', 'A loan from the finance office'], ans: 1,
      why: 'Money that goes out automatically, before you can spend it. The easiest way to pay yourself first.' },
    pension: { type: 'choice', prompt: 'You get out at **19 years**. What\'s your BRS pension?', opts: ['38% of base pay', '19% of base pay', '$0', 'Half of base pay'], ans: 2, why: '$0. The pension only starts at 20 years.' },
    match: { type: 'choice', prompt: 'How much do **you** have to put in the TSP to get the full 5% from the Air Force?', opts: ['1%', '3%', '5%', '10%'], ans: 2, why: '5%. The Air Force adds 1% automatically plus up to 4% more in match.' },
    tsp: { type: 'slider', prompt: 'Brand new 2d Lt: **$4,150.20** a month base pay. The 2026 TSP limit is **$24,500**. What % do you need to hit it this year?', info: 'The TSP only takes whole percents.',
      min: 0, max: 100, step: 1, unit: '%', start: 5, ans: 50, tol: 30, why: '50%. That\'s $24,901 a year, so you hit the $24,500 limit. 49% comes up just short.' },
    roth: { type: 'choice', prompt: 'You\'re a 2d Lt. **Roth or Traditional** TSP?', opts: ['Roth: pay the tax now, take it out tax free', 'Traditional: skip the tax now, pay it later'], ans: 0,
      why: 'Roth. Your tax rate will probably never be lower than it is as a 2d Lt.' },
    market: { type: 'choice', prompt: 'The market drops **10%** the month after you start investing. What do you do?', opts: ['Sell before it drops more', 'Keep buying every month', 'Stop the TSP until it recovers', 'Move it all to the G Fund'], ans: 1,
      why: 'Keep buying. You\'re buying on sale, and time in the market beats timing the market.' },
    calls: { type: 'calls', prompt: 'Make your five money calls. Your score is where your line ends at year 10.',
      calls: D4.CALLS.map((c) => ({ key: c.key, when: c.title.split(':')[0], ask: c.ask, opts: c.opts.map((o) => [String(o[0]), o[1]]) })),
      why: 'The best calls end near ' + fmt(V_BEST, { k: true }) + ' at year 10. The easy calls end at ' + fmt(V_EASY, { k: true }) + '.' },
  };
  Object.entries(QS).forEach(([id, q]) => {
    q.qid = id;
    if (q.type === 'choice') { q.score = choiceScore(q.ans); q.say = (v) => 'You picked: ' + q.opts[v]; q.answerText = '**' + q.opts[q.ans] + '.** ' + q.why; }
    if (q.type === 'slider') {
      const f = (v) => (q.unit === '$M' ? '$' + (v / 1e6).toFixed(2) + 'M' : v + q.unit);
      q.fmt = f; q.score = sliderScore(q.ans, q.tol); q.say = (v) => 'You said ' + f(v); q.answerText = q.why;
    }
    if (q.type === 'calls') {
      q.score = (v) => Math.round(1000 * clamp((CALL_V10(fixPick(v)) - V_EASY) / (V_BEST - V_EASY), 0, 1));
      q.say = (v) => 'Your year 10: ' + fmt(CALL_V10(fixPick(v)), { k: true }); q.answerText = q.why;
    }
    LIVE['q-' + id] = {
      head: 'On your phones', body: q.type === 'calls' ? 'Make all five calls on your phone, then lock it in.' : 'Answer on your phone. **Faster right answers score more.**',
      build(el) { return buildQ(el, q); },
    };
  });

  function buildQ(el, q) {
    el.innerHTML = `<div class="abs in" style="left:90px;top:56px;--d:.05"><div class="k">On your phones</div></div>
      <div class="abs in qprompt" style="left:90px;top:100px;width:1420px;--d:.15">${md(q.prompt)}</div>
      ${q.info ? `<div class="abs in qinfo" style="left:90px;top:250px;--d:.25">${md(q.info)}</div>` : ''}
      <div class="abs qbody" style="left:90px;top:330px;width:1420px;height:420px"></div>
      <div class="abs answered" style="left:90px;top:780px;width:1420px"><span class="cnt"></span><span class="faces"></span></div>`;
    const body = $('.qbody', el), cnt = $('.answered .cnt', el), faces = $('.answered .faces', el);
    const paint = () => {
      if (!el.isConnected) return;
      const L = ROOM.list(), A = L.filter((p) => p.ans && p.ans[q.qid]), rev = ROOM.phase === 'reveal' && ROOM.q === q;
      cnt.textContent = rev ? '' : `${A.length} of ${L.length} answered`;
      faces.innerHTML = rev ? '' : A.map((p) => face(p, 40)).join('');
      if (q.type === 'choice') {
        const n = q.opts.map((_, i) => A.filter((p) => p.ans[q.qid].v === i).length), mx = Math.max(1, ...n);
        body.innerHTML = `<div class="opts${q.opts.length > 2 ? ' four' : ''}">${q.opts.map((o, i) => `<div class="opt${rev ? (i === q.ans ? ' right' : ' wrong') : ''}">
          <b>${'ABCD'[i]}</b><span>${esc(o)}</span>${rev ? `<em>${n[i]}</em><i style="width:${n[i] / mx * 100}%"></i>` : ''}</div>`).join('')}</div>`;
      } else if (q.type === 'slider') {
        const x = (v) => 40 + 1340 * (v - q.min) / (q.max - q.min);
        const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => q.min + f * (q.max - q.min));
        body.innerHTML = `<div class="line"><i></i>${ticks.map((t) => `<span style="left:${x(t)}px">${q.fmt(t)}</span>`).join('')}
          ${rev ? A.map((p, k) => `<div class="pin" style="left:${x(p.ans[q.qid].v)}px;top:${-60 - (k % 4) * 46}px">${face(p, 40)}</div>`).join('') : ''}
          ${rev ? `<div class="truth" style="left:${x(q.ans)}px"><b>${q.fmt(q.ans)}</b></div>` : ''}</div>`;
      } else {
        const lo = Math.min(V_EASY, ...A.map((p) => CALL_V10(fixPick(p.ans[q.qid].v)))), hi = V_BEST;
        const x = (v) => 40 + 1340 * (v - lo) / Math.max(1, hi - lo);
        body.innerHTML = `<div class="line"><i></i><span style="left:${x(V_EASY)}px">Easy calls ${fmt(V_EASY, { k: true })}</span><span style="left:${x(V_BEST)}px">Best calls ${fmt(V_BEST, { k: true })}</span>
          ${rev ? A.map((p, k) => `<div class="pin" style="left:${x(CALL_V10(fixPick(p.ans[q.qid].v)))}px;top:${-60 - (k % 4) * 46}px">${face(p, 40)}</div>`).join('') : ''}</div>`;
      }
      if (rev) {
        const top = A.filter((p) => p.ans[q.qid].pts > 0).sort((a, b) => b.ans[q.qid].pts - a.ans[q.qid].pts).slice(0, 5);
        body.insertAdjacentHTML('beforeend', `<div class="why">${md(q.answerText)}</div>
          <div class="tops">${top.map((p) => `<span>${face(p, 44)}<b>+${p.ans[q.qid].pts}</b></span>`).join('')}</div>`);
      }
    };
    ROOM.listeners.push(paint);
    return {
      enter() { ROOM.start(); ROOM.open(q); paint(); },
      leave() { ROOM.close(); },
      next() { if (ROOM.q === q && ROOM.phase === 'open') { ROOM.reveal(); paint(); return true; } return false; },
    };
  }

  // ---- the scoreboard, with promotions
  const boardLive = (title) => ({
    head: title, body: 'Everyone starts as a 2d Lt. **Points get you promoted**, all the way to Col.',
    build(el) {
      el.innerHTML = `<div class="abs in" style="left:90px;top:56px;--d:.05"><div class="k">Scoreboard</div></div>
        <div class="abs in" style="left:90px;top:96px;--d:.1"><h1 style="font-size:58px">${esc(title)}</h1></div>
        <div class="abs ladder in" style="left:1180px;top:200px;width:330px;--d:.3">${FRChars.RANKS.slice().reverse().map((r) => `<div>${insig(r, 30)}<span>${r.rank}</span><em>${r.at.toLocaleString()}</em></div>`).join('')}</div>
        <div class="abs board" style="left:90px;top:200px;width:1050px"></div>`;
      const b = $('.board', el);
      const paint = () => {
        const L = ROOM.list().sort((x, y) => (y.score || 0) - (x.score || 0)), mx = Math.max(1, ...L.map((p) => p.score || 0));
        b.innerHTML = L.length ? L.slice(0, 10).map((p, i) => { const r = FRChars.rankOf(p.score || 0);
          return `<div class="row" style="--i:${i}"><b class="n">${i + 1}</b>${face(p, 44)}<span class="nm">${esc(p.name)}</span>${insig(r, 34)}<span class="bar"><i style="--w:${(p.score || 0) / mx * 100}%"></i></span><span class="pts">${(p.score || 0).toLocaleString()}</span></div>`; }).join('')
          + (L.length > 10 ? `<div class="more">+ ${L.length - 10} more</div>` : '')
          : '<div class="lab" style="font-size:26px">Nobody has joined yet. The room code is on the join slide.</div>';
      };
      ROOM.listeners.push(() => { if (el.isConnected && el.closest('.layer.on')) paint(); });
      return { enter: paint };
    },
  });
  LIVE.board1 = boardLive('After Your pay');
  LIVE.board2 = boardLive('After Your LES');
  LIVE.board3 = boardLive('After the BRS');
  LIVE.board4 = boardLive('Final standings');

  // ---- where it started: Oregon State and the student loans (Captain Russell, 24 Nov 2026)
  LIVE.osu = {
    head: 'Where it started', body: 'Oregon State University. I commissioned in June 2019 and went on active duty in June 2020 owing **$24,920** in student loans.',
    build(el) {
      el.innerHTML = `<div class="abs in osu" style="left:110px;top:120px;--d:.1"><div class="o1">OREGON STATE</div><div class="o2">UNIVERSITY</div><div class="o3">Corvallis, Oregon</div><div class="o4">Commissioned June 2019</div></div>
        <div class="abs in" style="left:860px;top:160px;width:640px;--d:.35"><div class="k">Student loans on day one</div><div class="big r" id="loan" style="font-size:96px;margin-top:10px;white-space:nowrap">$0</div>
          <div class="lab" style="font-size:28px;margin-top:20px">Paid off by 2022, about two years after I went on active duty.</div></div>`;
      const n = $('#loan', el); let raf = 0;
      return { enter() { cancelAnimationFrame(raf); const t0 = performance.now() + 500; const tick = (t) => { const p = clamp((t - t0) / 1600, 0, 1); n.textContent = '−' + fmt(24920.13 * (1 - Math.pow(1 - p, 3)), { cents: true }); if (p < 1) raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); }, leave() { cancelAnimationFrame(raf); } };
    },
  };

  // ---- keep the big things small: the real house and cars
  LIVE.big = {
    head: 'Keep the big things small', body: 'The house, the car and debt decide most of it. **Get those right and the little things don\'t hurt.**',
    build(el) {
      const A = FRChars.BASE;
      el.innerHTML = `<div class="abs in photo" style="left:80px;top:80px;width:760px;--d:.1"><img src="${A}house.jpg" alt="Our 2 bedroom, 1 bath house"><div class="cap"><b>Home</b>2 bed, 1 bath, Nevada, Iowa</div></div>
        <div class="abs in photo" style="left:880px;top:80px;width:640px;--d:.35"><img src="${A}venue.jpg" alt="2021 Hyundai Venue"><div class="cap"><b>Car</b>2021 Hyundai Venue. Paid off in 6 months, 60,000 miles</div></div>
        <div class="abs in photo" style="left:880px;top:500px;width:640px;--d:.6"><img src="${A}avalon.jpg" alt="2006 Toyota Avalon"><div class="cap"><b>Car</b>2006 Toyota Avalon from Grandma, 115,000 miles</div></div>`;
      return {};
    },
  };

  // ---- the five books
  const BOOKS = [
    ['The Richest Man in Babylon', 'George S. Clason', '#6b3f1d', '#f0d9a6', 'Pay yourself first.'],
    ['The Millionaire Next Door', 'Thomas J. Stanley · William D. Danko', '#14284b', '#f4efe3', 'Most millionaires don\'t look like it.'],
    ['Millionaire Mission', 'Brian Preston', '#0f5132', '#e8f5ee', 'Do things in the right order.'],
    ['Money for Couples', 'Ramit Sethi', '#b8433a', '#fff4ee', 'Actually talk about money together.'],
    ['The Simple Path to Wealth', 'JL Collins', '#eef2f7', '#1e3a6e', 'Spend less, invest the rest in index funds.'],
  ];
  LIVE.books = {
    head: 'Where these ideas come from', body: 'Five books I\'d hand any new lieutenant. **Each money call is tied to one of them.**',
    build(el) {
      el.innerHTML = `<div class="abs in" style="left:90px;top:60px;--d:.05"><div class="k">Recommended reading</div></div>
        <div class="abs books" style="left:90px;top:130px;width:1420px">${BOOKS.map(([t, a, bg, fg, idea], i) => `<div class="book in" style="--d:${0.15 + i * 0.15}">
          <div class="cover" style="background:${bg};color:${fg}"><div class="t">${esc(t)}</div><div class="a">${esc(a)}</div></div><p>${esc(idea)}</p></div>`).join('')}</div>`;
      return {};
    },
  };

  // ======================================================================
  // the slide list
  // ======================================================================
  const SL = [];
  const scn = (id, sec, from, to) => { const s = SCENES[id].sc.steps; const a = from == null ? 0 : stepOf(id, from), b = to == null ? s.length - 1 : stepOf(id, to); for (let i = a; i <= b; i++) SL.push({ sec, scene: id, i }); };
  const live = (id, sec) => SL.push({ sec, live: id });
  live('title', 0); live('obj', 0); live('join', 0);
  live('q-post', 1); scn('fr1', 1, 'What did you find?', 'What did you find?'); live('q-captain', 1); scn('fr1', 1, 'Now compare it', 'Lead with it');
  live('q-life', 1); scn('fr1', 1, 'Avoid lifestyle inflation', 'Avoid lifestyle inflation'); live('life', 1); live('board1', 1);
  scn('fr1', 2, 'This was me in 2019.', 'This was me in 2019.'); live('osu', 2); scn('fr1', 2, 'This is me today.', 'What I got wrong'); live('wait', 2);
  scn('fr1', 2, 'What I got right', 'What I got right'); live('big', 2);
  live('q-taxed', 3); scn('fr2', 3, 'My real LES', 'Deductions: what is taken out'); live('q-allot', 3); scn('fr2', 3, 'Allotments: pay yourself first'); live('board2', 3);
  scn('fr3', 4, 'Three parts, one system', 'Three parts, one system'); live('q-pension', 4); scn('fr3', 4, '1. The pension', '1. The pension');
  live('q-match', 4); live('tsp', 4); live('q-tsp', 4); scn('fr3', 4, '3. Continuation pay', '3. Continuation pay'); live('q-roth', 4); scn('fr3', 4, 'Roth or Traditional?', 'Roth or Traditional?');
  live('q-market', 5); live('zoom', 5); scn('fr3', 5, 'Always be buying', 'The one rule'); live('board3', 5);
  live('books', 6); live('q-calls', 6); live('calls', 6); scn('fr4', 6, 'My mantra', 'My mantra'); live('board4', 6);
  live('close', 6);
  SL.forEach((s) => { if (s.scene) { const m = SCENES[s.scene].sc.steps[s.i].meta; s.head = m.head; s.body = m.body; } else { s.head = LIVE[s.live].head; s.body = LIVE[s.live].body; } });

  // live slide layers, built on first use
  const built = {};
  function liveLayer(id) {
    if (!built[id]) {
      const layer = document.createElement('div'); layer.className = 'layer';
      const el = document.createElement('div'); el.className = 'live'; el.style.cssText = 'position:absolute;inset:0';
      layer.appendChild(el); stage.appendChild(layer);
      built[id] = { layer, api: LIVE[id].build(el) || {} };
    }
    return built[id];
  }

  // ======================================================================
  // presenting
  // ======================================================================
  const players = {};
  let cur = -1, raf = 0, onLayer = null, onLive = null;
  function show(layer) {
    if (onLayer === layer) return;
    if (onLayer) onLayer.classList.remove('on');
    layer.classList.add('on'); onLayer = layer;
  }
  function playScene(id, i, animate) {
    const d = SCENES[id];
    if (!players[id]) players[id] = new Player(d.svg, d.sc);
    const P = players[id];
    cancelAnimationFrame(raf);
    playingScene = null;
    if (!animate || reduce) { P.renderEnd(i); return; }
    if (i === 0) P.renderBase(); else P.renderEnd(i - 1);
    const dur = d.sc.duration(i), t0 = performance.now() + (onLayer === d.layer ? 0 : 250);
    playingScene = { id, i };
    const tick = (now) => { const t = clamp((now - t0) / 1000, 0, dur); P.render(i, t); if (t < dur) raf = requestAnimationFrame(tick); else playingScene = null; };
    raf = requestAnimationFrame(tick);
  }
  function render(k, animate) {
    const s = SL[k];
    if (onLive && onLive.leave) onLive.leave();
    onLive = null;
    if (s.scene) { playScene(s.scene, s.i, animate); show(SCENES[s.scene].layer); }
    else { cancelAnimationFrame(raf); playingScene = null; const b = liveLayer(s.live); show(b.layer); onLive = b.api; if (onLive.enter) requestAnimationFrame(() => onLive.enter()); }
    // caption
    const txt = $('#cap .txt');
    $('#head').innerHTML = md(s.head); $('#body').innerHTML = md(s.body);
    txt.classList.remove('swap'); void txt.offsetWidth; txt.classList.add('swap');
    // bar
    $('#count').textContent = `${k + 1} / ${SL.length}`;
    $('#prog i').style.width = ((k + 1) / SL.length * 100) + '%';
    $$('#tabs button').forEach((b, i) => {
      const idx = SL.map((x, j) => [x, j]).filter(([x]) => x.sec === i).map(([, j]) => j);
      const p = k < idx[0] ? 0 : k > idx[idx.length - 1] ? 1 : (k - idx[0] + 1) / idx.length;
      b.style.setProperty('--p', p); b.classList.toggle('on', s.sec === i); b.classList.toggle('done', k > idx[idx.length - 1]);
    });
    $('[data-act=prev]').disabled = k === 0; $('[data-act=next]').disabled = k === SL.length - 1;
    try { history.replaceState(null, '', '#' + (k + 1)); } catch (e) {}
  }
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  // a band that sweeps across when a new section starts; the slide changes behind it
  function sweep(sec, then) {
    if (reduce) { then(); return; }
    const band = document.createElement('div'); band.className = 'sweep';
    band.innerHTML = `<i></i><b><em>PART ${sec}</em><span>${esc(SECS[sec].sweep)}</span></b><i></i>`;
    $('#view').appendChild(band);
    const W = $('#view').clientWidth;
    const a = band.animate([{ transform: `translateX(${W}px) skewX(-12deg)` }, { transform: `translateX(${-W * 0.2}px) skewX(-12deg)`, offset: 0.45 }, { transform: `translateX(${-W * 0.2}px) skewX(-12deg)`, offset: 0.62 }, { transform: `translateX(${-W * 1.6}px) skewX(-12deg)` }],
      { duration: 1500, easing: 'cubic-bezier(.6,0,.4,1)' });
    setTimeout(then, 700);
    a.onfinish = () => band.remove();
  }
  function go(k, animate) {
    k = clamp(k, 0, SL.length - 1);
    if (k === cur) return;
    const from = cur; cur = k;
    if (animate && from >= 0 && SL[k].sec !== SL[from].sec && k === from + 1) sweep(SL[k].sec, () => render(k, true));
    else render(k, animate);
  }
  let playingScene = null;
  const next = () => { if (onLive && onLive.next && onLive.next()) return; if (playingScene) { cancelAnimationFrame(raf); players[playingScene.id].renderEnd(playingScene.i); playingScene = null; return; } go(cur + 1, true); };
  const prev = () => { if (playingScene) { cancelAnimationFrame(raf); playingScene = null; } go(cur - 1, false); };
  function replay() {
    const s = SL[cur];
    if (s.scene) playScene(s.scene, s.i, true);
    else if (onLive) { if (onLive.replay) onLive.replay(); else { const b = built[s.live]; b.layer.classList.remove('on'); onLayer = null; requestAnimationFrame(() => render(cur, true)); } }
  }

  // the market ticker: the lesson's own numbers
  (function ticker() {
    const Z = D3.ZOOMS, ch = (z) => (z.pts[z.pts.length - 1][1] / z.pts[0][1] - 1) * 100;
    const pct = (v) => (v >= 0 ? '▲ +' : '▼ −') + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: Math.abs(v) < 10 ? 1 : 0 }) + '%';
    const items = [
      ['O-1 PAY', '$6,062.68/MO', 'gd'], ['S&P 500 1 DAY', pct(ch(Z[0])), ch(Z[0]) < 0 ? 'd' : 'u'], ['TSP MATCH', 'UP TO 5%', 'gd'],
      ['S&P 500 1 YR', pct(ch(Z[2])), 'u'], ['BAH + BAS', 'TAX FREE', 'gd'], ['S&P 500 10 YR', pct(ch(Z[3])), 'u'],
      ['PENSION', '2% × YEARS', 'gd'], ['S&P 500 100 YR', pct(ch(Z[4])), 'u'], ['CONT PAY', '2.5× MONTHLY BASE', 'gd'],
      ['STUDENT LOANS', '$24,920 → $0', 'u'], ['SAVINGS RATE', '~50%', 'u'], ['NET WORTH', '−$20K → $290K', 'u'],
    ];
    const one = items.map(([k, v, c]) => `<span>${k}<b class="${c}">${v}</b></span>`).join('');
    $('#ticker .tape').innerHTML = one + one;
  })();

  // a click on the slide goes on, like any slideshow; controls on the slide keep working
  stage.classList.add('go');
  stage.addEventListener('click', (e) => {
    if (e.target.closest('input, button, select, a, label, .seg, .slide-ctl, .calls')) return;
    next();
  });

  // tabs
  $('#tabs').innerHTML = SECS.map((s, i) => `<button type="button" data-sec="${i}" title="${esc(s.name)}"><b>${i}</b><span>${esc(s.name)}</span><i></i></button>`).join('');
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.blur(); go(SL.findIndex((s) => s.sec === +b.dataset.sec), true); });

  // buttons
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    b.blur();
    const a = b.dataset.act;
    if (a === 'next') next(); else if (a === 'prev') prev();
    else if (a === 'full') full();
    else if (a === 'help') $('#help').hidden = !$('#help').hidden;
  });
  function full() { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {} }
  $('#blank').addEventListener('click', () => { $('#blank').hidden = true; });

  // keys: always change slides, even while a slider has focus
  window.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    if (!$('#blank').hidden && k !== 'F' && k !== 'f') { e.preventDefault(); $('#blank').hidden = true; return; }
    if (!$('#help').hidden && (k === 'Escape' || k === 'h' || k === 'H' || k === '?')) { $('#help').hidden = true; return; }
    if (['ArrowRight', 'PageDown', ' ', 'n', 'N', 'Enter'].includes(k)) { if (k === 'Enter' && e.target.closest('button')) return; e.preventDefault(); next(); }
    else if (['ArrowLeft', 'PageUp', 'p', 'P', 'Backspace'].includes(k)) { e.preventDefault(); prev(); }
    else if (k === 'Home') { e.preventDefault(); go(0, false); }
    else if (k === 'End') { e.preventDefault(); go(SL.length - 1, false); }
    else if (k === 'r' || k === 'R') replay();
    else if (k === 'f' || k === 'F') full();
    else if (k === 'b' || k === 'B' || k === '.') $('#blank').hidden = false;
    else if (k === 'h' || k === 'H' || k === '?') $('#help').hidden = false;
    else if (k === 'ArrowUp' || k === 'ArrowDown') { if (e.target.matches('input[type=range]')) e.preventDefault(); }
  }, true);

  // scale the 1600 x 900 stage to fit
  function fit() {
    const v = $('#view'), pad = innerWidth < 700 ? 8 : 24;
    const s = Math.min((v.clientWidth - pad * 2) / 1600, (v.clientHeight - pad * 2) / 900);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
    stage.style.transformOrigin = 'center';
    stage.style.borderRadius = (18 / s) * 0.6 + 'px';
    Anim.setStageWidth(1600 * s, 1600);
  }
  addEventListener('resize', fit); fit();
  addEventListener('hashchange', () => { const n = parseInt(location.hash.slice(1), 10); if (n && n - 1 !== cur) go(n - 1, false); });

  ROOM.start();
  const start = parseInt(location.hash.slice(1), 10);
  go(start > 0 ? start - 1 : 0, true);
})();
