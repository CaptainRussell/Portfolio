/* fr.js: Financial Readiness additions to the Internet Secrets lesson engine
 * (../../../internet-secrets/lessons/shared/engine.js and lesson.js), which every chapter reuses as is.
 *
 *   FR.CHAPTERS     the four chapters in order (the chapter picker and each chapter's last button)
 *   FR.next(id)     where a chapter's score screen sends the learner
 *   Anim.KINDS.money  a dollar figure that counts smoothly between values: props num, fill; cfg size, weight, anchor, pre, post,
 *                     k (show in thousands), les (an LES amount, 7737.00), cents ($6,062.68), fit (as for text)
 *   FR.fmt(n)       "$10,732", "−$20,000"
 * Code organized with help from Claude (Anthropic), Nov 2026.
 */
(function (root) {
  'use strict';
  const { el, C, FONT } = root.Anim;
  const CHAPTERS = [
    { id: 'fr1', href: 'c1-from-minus-20k/', n: 1, name: 'From −$20K', blurb: 'Your discussion post, then my real net worth, budget and mistakes.' },
    { id: 'fr2', href: 'c2-first-les/', n: 2, name: 'Your first LES', blurb: 'Build a 2d Lt paycheck from the three types of pay.' },
    { id: 'fr3', href: 'c3-brs/', n: 3, name: 'The BRS', blurb: 'Pension, TSP match and continuation pay, and the 5% rule.' },
    { id: 'fr4', href: 'c4-money-calls/', n: 4, name: 'Money calls', blurb: 'Five decisions from your first ten years, next to my real line.' },
  ];
  function next(id) {
    const i = CHAPTERS.findIndex((c) => c.id === id);
    if (i < CHAPTERS.length - 1) return { href: '../' + CHAPTERS[i + 1].href, label: `Next: ${CHAPTERS[i + 1].name}` };
    return { href: '../', label: 'All chapters' };
  }
  const fmt = (n, o) => {
    o = o || {};
    if (o.les) return (n < 0 ? '-' : '') + Math.abs(n).toFixed(2);   // an LES amount: 7737.00
    if (o.cents) return (n < 0 ? '−' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });   // $6,062.68
    let v = Math.round(n);
    const neg = v < 0; v = Math.abs(v);
    const body = o.k ? (v / 1000).toLocaleString('en-US', { maximumFractionDigits: v < 10000 && v % 1000 ? 1 : 0 }) + 'K' : v.toLocaleString('en-US');
    return (neg ? '−' : o.plus ? '+' : '') + (o.pre != null ? o.pre : '$') + body + (o.post || '');
  };
  root.Anim.KINDS.money = {
    defaults: { num: 0, fill: C.ink },
    create(g, cfg) {
      const r = el('g', {}, g);
      const t = el('text', { 'font-family': cfg.mono ? root.Anim.MONO : FONT, 'font-size': cfg.size || 40, 'font-weight': cfg.weight || 800,
        'text-anchor': cfg.anchor || 'middle', ...(cfg.fit != null ? { 'data-fit': cfg.fit === false ? 'no' : cfg.fit } : {}) }, r);
      return { root: r, t, cfg, s: null, a: {} };
    },
    update(h, p) {
      const sa = (n, k, v) => { if (h.a[n + k] !== v) { h.a[n + k] = v; (n === 'r' ? h.root : h.t).setAttribute(k, v); } };
      sa('r', 'transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) scale(${p.s.toFixed(4)})`);
      sa('r', 'opacity', p.o.toFixed(3));
      sa('t', 'fill', p.fill);
      const s = fmt(p.num, h.cfg);
      if (s !== h.s) { h.t.textContent = s; h.s = s; }
    },
  };
  root.FR = { CHAPTERS, next, fmt };
})(this);
