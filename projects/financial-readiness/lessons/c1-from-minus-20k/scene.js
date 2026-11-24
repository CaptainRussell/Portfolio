/* Chapter 1 scene, shared by the chapter page (lesson player) and the slide deck (../../slides/).
   Exposes FR.SCENES.fr1. */
(function () {
'use strict';
/* =====================================================================
   Chapter 1: From −$20K
   My net worth at the start of each year, 2019 to now, drawn as it grew:
   three years digging out of debt, crossing zero in 2022, then the curve
   bending as each year's gain beats the last. Then my real October 2026
   budget (O-3 over 6, married, one child, Ames, Iowa): what comes in
   (base pay, BAH, BAS, TSP match), where it goes (half saved and
   invested), the line items, and what the net worth is made of.
   Source: my own budget spreadsheet (October 2026 tab).
   Code organized with help from Claude (Anthropic).
   ===================================================================== */
const { Scene, C } = Anim;
const fmt = FR.fmt;

// ---------------------------------------------------------------- data (October 2026 tab)
// today's total from the real balances on 23 and 24 Nov 2026 (TSP, both Fidelity Roth IRAs) plus the sheet's cash, cars and home equity
const NOW = 290039;
const NW = [[2019, -20000], [2020, -12000], [2021, -3500], [2022, 24000], [2023, 58000], [2024, 110000], [2025, 170000], [2026, 240000], [2026.9, NOW]];
const PAY_IN = [['Base pay', 7737, C.cyan], ['BAH', 2280, C.violet], ['BAS', 328.48, C.blue], ['TSP match', 386.85, C.green]];
const GROSS = 10732.33;
const OUT = [['Saving and investing', 5398.17, C.green], ['Living', 3990.94, C.amber], ['Taxes and insurance', 1334.16, C.red]];
const SAVE = [['Roth TSP (27%)', 2088.99], ['Emergency fund', 1672.33], ['Roth IRA', 625], ['Spouse Roth IRA', 625], ['TSP 1% + 4% match', 386.85]];
const LIVE = [['Mortgage', 1550], ['Groceries', 900], ['Misc', 450], ['Utilities', 445.46], ['Pets', 200], ['Subscriptions + haircut', 120],
  ['Gasoline', 100], ['Eating out', 100], ['Sydney', 100], ['Car insurance', 25.47]];
const WORTH = [['Roth TSP (C Fund)', 198148, C.green], ['Roth IRAs', 54091, C.cyan], ['Emergency fund', 16000, C.blue], ['Cars', 15000, C.violet], ['Home equity', 6500, C.amber], ['Brokerage', 300, C.soft]];
// The projection (Captain Russell, 24 Nov 2026: "show that I've already won the game"): what is invested today
// (TSP + both Roth IRAs + brokerage) grows at 7% a year after inflation, in today's dollars. Keep going adds this
// year's $44,142 (max TSP, max both IRAs, the match) every year; Stop adds nothing. Cash, cars and home equity stay flat.
const INVESTED = 198148 + 26386 + 27705 + 300, OTHER = NOW - INVESTED, REAL = 0.07, YEARLY = 44142;
function project(add) {
  const pts = [[2026.9, NOW]]; let inv = INVESTED, yr = 2026.9;
  while (true) {
    const nxt = inv * (1 + REAL) + add, v0 = inv + OTHER, v1 = nxt + OTHER;
    if (v1 >= 1e6) { const f = (1e6 - v0) / (v1 - v0); pts.push([yr + f, 1e6]); return { pts, hit: yr + f }; }
    inv = nxt; yr += 1; pts.push([yr, inv + OTHER]);
  }
}
const KEEP = project(YEARLY), STOP = project(0);
// What I put in the TSP (my W-2s; Captain Russell, 24 Nov 2026) and the taxable base pay on the same W-2s.
// Commissioned June 2019, active duty 14 June 2020, 1st Lt December 2021, Captain December 2023. Maxed out the TSP from 2023.
const TSP_IN = [[2021, 6308.33, 41155.49, '1st Lt'], [2022, 16278.46, 59276.08, ''], [2023, 22500, 67622.12, 'Capt'], [2024, 23000, 81673.2, ''], [2025, 23500, 87579.28, '']];
const LIFETIME = 435971.46;   // all base pay on my W-2s, June 2020 to October 2026

// ---------------------------------------------------------------- chart geometry
const CX0 = 250, CX1 = 1450, CY0 = 790, CY1 = 170;
const xOf = (yr) => CX0 + (yr - 2019) * (CX1 - CX0) / 8.2;
const yOf = (v) => CY0 - (v + 50000) * (CY0 - CY1) / 400000;
const PTS = NW.map(([yr, v]) => [xOf(yr), yOf(v)]);
const line = (a, b) => 'M ' + PTS.slice(a, b + 1).map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L ');
const AREA = line(0, PTS.length - 1) + ` L ${PTS[PTS.length - 1][0].toFixed(1)} ${yOf(0).toFixed(1)} L ${PTS[0][0].toFixed(1)} ${yOf(0).toFixed(1)} Z`;
// the goal chart (last two steps): 2019 to 2049, 0 to 1.1M
const GX0 = 250, GX1 = 1450, GY0 = 770, GY1 = 230;
const gx = (yr) => GX0 + (yr - 2019) * (GX1 - GX0) / 30, gy = (v) => GY0 - (v + 50000) * (GY0 - GY1) / 1150000;
const GHIST = 'M ' + NW.map(([yr, v]) => gx(yr).toFixed(1) + ' ' + gy(v).toFixed(1)).join(' L ');
const pathOf = (pts) => 'M ' + pts.map(([yr, v]) => gx(yr).toFixed(1) + ' ' + gy(v).toFixed(1)).join(' L ');
const age = (yr) => Math.floor(yr - 1995.3);   // 31 in Nov 2026, 40 in April 2035

// a horizontal bar made of segments, each in proportion to its amount
const BX = 160, BW = 1280;
function segs(list, total) { let x = BX; return list.map((s) => { const w = s[1] / total * BW; const r = { x, w, mid: x + w / 2 }; x += w; return r; }); }

function scene(st) {
  const S = new Scene('fr1');
  const all = [];
  const add = (id, kind, cfg, props) => { all.push(id); return S.add(id, kind, cfg, props); };

  // ---- the opener: the pre-class discussion post (O-1, 0 years, single, off base in San Antonio 78236, 2026 rates)
  // and lifestyle inflation (Captain Russell, 24 Nov 2026: "put away that excess above your baseline")
  const HW = [['Base pay (O-1, under 2 years)', 4150.20], ['BAH (single, San Antonio 78236)', 1584], ['BAS (officers)', 328.48]];
  add('hwHead', 'text', { size: 44, anchor: 'middle', weight: 850, maxw: 1400 }, { x: 800, y: 130, content: 'Your discussion post: a brand new 2d Lt', fill: C.ink, o: 0 });
  add('hwSub', 'text', { size: 28, anchor: 'middle', weight: 600, maxw: 1400 }, { x: 800, y: 178, content: 'Single, off base in San Antonio, 2026 rates', fill: C.soft, o: 0 });
  HW.forEach(([n, v], i) => {
    add('hwL' + i, 'text', { size: 34, anchor: 'start', weight: 650, maxw: 760 }, { x: 260, y: 290 + i * 80, content: n, fill: C.ink, o: 0 });
    add('hwV' + i, 'text', { size: 38, anchor: 'end', weight: 800, mono: true }, { x: 1340, y: 290 + i * 80, content: fmt(v, { cents: true }), fill: C.ink, o: 0 });
  });
  add('hwRule', 'rect', {}, { x: 260, y: 482, w: 0, h: 4, rx: 2, fill: C.soft, o: 0 });
  add('hwM', 'money', { size: 96, weight: 850, mono: true, cents: true }, { x: 800, y: 620, num: 0, fill: C.green, o: 0 });
  add('hwML', 'text', { size: 32, anchor: 'middle', weight: 650 }, { x: 800, y: 680, content: 'a month', fill: C.soft, o: 0 });
  add('hwY', 'text', { size: 44, anchor: 'middle', weight: 800, mono: true }, { x: 800, y: 790, content: '$72,752.16 a year', fill: C.cyan, o: 0 });

  // officer vs enlisted (Captain Russell, 24 Nov 2026): base pay + BAH + BAS, no dependents, off base in San Antonio
  // (78252), 2026 rates, from his pay calculator screenshots. An O-3 at 8 years out-earns an E-8 at 20.
  const OE = [['Day 1', 'O-1', 6062.20, 'E-1', 4242.20], ['2 years', 'O-2', 7601.20, 'E-3', 4850.00], ['4 years', 'O-3', 9717.70, 'E-4', 5493.50], ['8 years', 'O-3', 10460.50, 'E-5', 6275.90]];
  const E8 = 9391.40, OB = 720, OHmax = 390, oh = (v) => v / 11000 * OHmax, ogx = (i) => 250 + i * 270;
  add('oeHead', 'text', { size: 44, anchor: 'middle', weight: 850, maxw: 1400 }, { x: 800, y: 96, content: 'Officer vs enlisted: the same Air Force', fill: C.ink, o: 0 });
  add('oeSub', 'text', { size: 26, anchor: 'middle', weight: 600, maxw: 1400 }, { x: 800, y: 138, content: 'A month of base pay, BAH and BAS. No dependents, San Antonio, 2026.', fill: C.soft, o: 0 });
  OE.forEach(([yrs, og, ov, eg, ev], i) => {
    const x = ogx(i);
    add('oeO' + i, 'rect', {}, { x: x - 100, y: OB, w: 96, h: 0, rx: 8, fill: C.cyan, o: 0 });
    add('oeOv' + i, 'text', { size: 26, anchor: 'middle', weight: 800, mono: true }, { x: x - 52, y: OB - oh(ov) - 14, content: ov >= 10000 ? '$' + (ov / 1000).toFixed(1) + 'K' : fmt(ov, { k: true }), fill: C.cyan, o: 0 });
    add('oeE' + i, 'rect', {}, { x: x + 4, y: OB, w: 96, h: 0, rx: 8, fill: C.amber, o: 0 });
    add('oeEv' + i, 'text', { size: 26, anchor: 'middle', weight: 800, mono: true }, { x: x + 52, y: OB - oh(ev) - 14, content: fmt(ev, { k: true }), fill: C.amber, o: 0 });
    add('oeG' + i, 'text', { size: 24, anchor: 'middle', weight: 800, mono: true }, { x, y: OB + 38, content: `${og} · ${eg}`, fill: C.soft, o: 0 });
    add('oeY' + i, 'text', { size: 24, anchor: 'middle', weight: 600 }, { x, y: OB + 72, content: yrs, fill: C.faint, o: 0 });
  });
  const ex8 = 1380;
  add('oeE8', 'rect', {}, { x: ex8 - 48, y: OB, w: 96, h: 0, rx: 8, fill: C.amber, o: 0 });
  add('oeE8v', 'text', { size: 26, anchor: 'middle', weight: 800, mono: true }, { x: ex8, y: OB - oh(E8) - 14, content: fmt(E8, { k: true }), fill: C.amber, o: 0 });
  add('oeE8g', 'text', { size: 24, anchor: 'middle', weight: 800, mono: true }, { x: ex8, y: OB + 38, content: 'E-8 (SMSgt)', fill: C.soft, o: 0 });
  add('oeE8y', 'text', { size: 24, anchor: 'middle', weight: 600 }, { x: ex8, y: OB + 72, content: '20 years', fill: C.faint, o: 0 });
  add('oeLine', 'rect', {}, { x: ogx(3) - 100, y: OB - oh(10460.5) - 2, w: 0, h: 4, rx: 2, fill: C.cyan, o: 0 });
  add('oeBig', 'text', { size: 34, anchor: 'end', weight: 850, maxw: 900 }, { x: 1440, y: 214, content: 'A captain at 8 years out-earns a', fill: C.ink, o: 0 });
  add('oeBig2', 'text', { size: 34, anchor: 'end', weight: 850, maxw: 900 }, { x: 1440, y: 256, content: 'senior master sergeant at 20.', fill: C.ink, o: 0 });
  add('oeKey', 'text', { size: 24, anchor: 'start', weight: 800 }, { x: 150, y: 214, content: '■ Officer', fill: C.cyan, o: 0 });
  add('oeKey2', 'text', { size: 24, anchor: 'start', weight: 800 }, { x: 150, y: 250, content: '■ Enlisted', fill: C.amber, o: 0 });

  add('ldQ1', 'text', { size: 44, anchor: 'middle', weight: 850, maxw: 1400 }, { x: 800, y: 250, content: 'Your troops will have a harder time with money than you will.', fill: C.ink, o: 0 });
  add('ldA', 'text', { size: 38, anchor: 'middle', weight: 750, maxw: 1400 }, { x: 800, y: 400, content: 'Never brag about your money in front of them.', fill: C.red, o: 0 });
  add('ldB', 'text', { size: 38, anchor: 'middle', weight: 750, maxw: 1400 }, { x: 800, y: 470, content: 'Never complain about your pay in front of them.', fill: C.red, o: 0 });
  add('ldC', 'text', { size: 50, anchor: 'middle', weight: 850, maxw: 1400 }, { x: 800, y: 640, content: 'You are paid the big money', fill: C.green, o: 0 });
  add('ldD', 'text', { size: 50, anchor: 'middle', weight: 850, maxw: 1400 }, { x: 800, y: 710, content: 'to make big decisions.', fill: C.green, o: 0 });

  const LB = 3000, LP = 6062.68, LX = 200, LWD = 1200;
  add('liHead', 'text', { size: 44, anchor: 'middle', weight: 850, maxw: 1400 }, { x: 800, y: 130, content: 'The easiest way to win', fill: C.ink, o: 0 });
  add('liAl', 'text', { size: 28, anchor: 'start', weight: 700 }, { x: LX, y: 236, content: 'What you live on now, as a cadet', fill: C.soft, o: 0 });
  add('liA', 'rect', {}, { x: LX, y: 256, w: 0, h: 90, rx: 8, fill: C.amber, fo: 0.85, o: 0 });
  add('liAv', 'text', { size: 34, anchor: 'end', weight: 850, mono: true }, { x: LX + LWD * LB / LP - 20, y: 314, content: 'about $3,000', fill: '#06101c', o: 0 });
  add('liBl', 'text', { size: 28, anchor: 'start', weight: 700 }, { x: LX, y: 416, content: 'Your first month as a 2d Lt', fill: C.soft, o: 0 });
  add('liB', 'rect', {}, { x: LX, y: 436, w: 0, h: 90, rx: 8, fill: C.amber, fo: 0.85, o: 0 });
  add('liX', 'rect', {}, { x: LX + LWD * LB / LP, y: 436, w: 0, h: 90, rx: 8, fill: C.green, fo: 0.9, o: 0 });
  add('liXv', 'text', { size: 34, anchor: 'middle', weight: 850, mono: true }, { x: LX + LWD * (LB / LP + (1 - LB / LP) / 2), y: 494, content: '+$3,063', fill: '#06101c', o: 0 });
  add('liBig', 'text', { size: 56, anchor: 'middle', weight: 850, maxw: 1400 }, { x: 800, y: 650, content: 'Keep living on $3,000. Bank the rest.', fill: C.green, o: 0 });
  add('liSub', 'text', { size: 30, anchor: 'middle', weight: 600, maxw: 1400 }, { x: 800, y: 720, content: 'Invested for your first 4 years at 7%: about $168,000.', fill: C.ink, o: 0 });
  add('liSub2', 'text', { size: 30, anchor: 'middle', weight: 600, maxw: 1400 }, { x: 800, y: 770, content: 'Left alone until you are 60: about $1.7 million, in today\'s dollars.', fill: C.amber, o: 0 });

  // ---- the opening number
  add('big', 'money', { size: 150, weight: 850 }, { x: 800, y: 430, num: -20000, fill: C.red, o: 0 });
  add('bigSub', 'text', { size: 38, anchor: 'middle', weight: 600 }, { x: 800, y: 640, content: 'Fresh out of college. Student loans. No savings.', fill: C.soft, o: 0 });
  add('bigYr', 'text', { size: 44, anchor: 'middle', weight: 800, mono: true }, { x: 800, y: 270, content: '2019', fill: C.soft, o: 0 });

  // ---- the chart
  [0, 100000, 200000, 300000].forEach((v) => {
    add('g' + v, 'rect', {}, { x: CX0 - 20, y: yOf(v) - 1, w: CX1 - CX0 + 60, h: v ? 2 : 4, rx: 1, fill: v ? C.line : C.soft, o: 0 });
    add('gl' + v, 'text', { size: 26, anchor: 'end', weight: 600, mono: true }, { x: CX0 - 32, y: yOf(v) + 9, content: v ? '$' + v / 1000 + 'K' : '$0', fill: C.faint, o: 0 });
  });
  for (let yr = 2019; yr <= 2026; yr++) add('yr' + yr, 'text', { size: 26, anchor: 'middle', weight: 600, mono: true }, { x: xOf(yr), y: CY0 + 48, content: String(yr), fill: C.faint, o: 0 });
  add('area', 'path', { d: AREA }, { stroke: 'none', fill: 'rgba(52,245,164,.10)', o: 0 });
  add('l1', 'path', { d: line(0, 2) }, { stroke: C.red, sw: 7, draw: 0 });
  add('l2', 'path', { d: line(2, 3) }, { stroke: C.amber, sw: 7, draw: 0 });
  add('l3', 'path', { d: line(3, PTS.length - 1) }, { stroke: C.green, sw: 7, draw: 0 });
  PTS.forEach((p, i) => {
    add('p' + i, 'dot', {}, { x: p[0], y: p[1], r: 11, fill: NW[i][1] < 0 ? C.red : C.green, stroke: C.panel, sw: 4, o: 0, s: 0.2 });
    const last = i === PTS.length - 1;
    add('pv' + i, 'text', { size: last ? 34 : 25, anchor: i >= 3 ? 'end' : 'middle', weight: 800, mono: true },
      { x: p[0] + (i >= 3 ? -20 : 0), y: p[1] + (NW[i][1] < 0 ? 52 : i >= 3 ? -16 : -24), content: fmt(NW[i][1], { k: true }), fill: NW[i][1] < 0 ? C.red : C.ink, o: 0 });
  });
  add('zeroTag', 'text', { size: 30, anchor: 'start', weight: 800 }, { x: xOf(2022) + 80, y: yOf(0) + 46, content: 'Crossed $0', fill: C.amber, o: 0 });

  // ---- each year's gain, as bars
  const GAINS = NW.slice(1, -1).map(([yr, v], i) => [NW[i][0], v - NW[i][1]]);   // whole years only
  const BASE = 760, BMAX = 70000, BH = 430;
  GAINS.forEach(([yr, g], i) => {
    const h = g / BMAX * BH, x = 800 + (i - 3) * 170;
    add('gb' + i, 'rect', {}, { x: x - 46, y: BASE, w: 92, h: 0, rx: 8, fill: i < 2 ? C.amber : C.green, o: 0 });
    add('gv' + i, 'text', { size: 27, anchor: 'middle', weight: 800, mono: true }, { x, y: BASE - h - 16, content: fmt(g, { k: true, plus: true }), fill: C.ink, o: 0 });
    add('gy' + i, 'text', { size: 22, anchor: 'middle', weight: 600, mono: true }, { x, y: BASE + 38, content: `${yr}`, fill: C.faint, o: 0 });
  });
  add('gainHead', 'text', { size: 40, anchor: 'middle', weight: 800 }, { x: 800, y: 130, content: 'What each year added', fill: C.ink, o: 0 });

  // ---- the guess
  add('qHead', 'text', { size: 52, anchor: 'middle', weight: 800 }, { x: 800, y: 290, content: 'How much of each paycheck do I save and invest?', fill: C.ink, o: 0 });
  const CH = ['10%', '25%', '50%'];
  CH.forEach((c, i) => {
    add('ch' + i, 'rect', {}, { x: 480 + i * 320 - 120, y: 430, w: 240, h: 170, rx: 26, fill: C.panel2, stroke: C.cyan, sw: 4, o: 0 });
    add('cht' + i, 'text', { size: 72, anchor: 'middle', weight: 850, mono: true }, { x: 480 + i * 320, y: 540, content: c, fill: C.cyan, o: 0 });
  });

  // ---- the paycheck: what comes in
  add('inHead', 'text', { size: 40, anchor: 'start', weight: 800 }, { x: BX, y: 100, content: 'My October paycheck: $10,732 a month', fill: C.ink, o: 0 });
  add('inSub', 'text', { size: 26, anchor: 'start', weight: 600 }, { x: BX, y: 142, content: 'Captain, over 6 years, married with one child, Ames, Iowa', fill: C.soft, o: 0 });
  const IN = segs(PAY_IN, GROSS);
  PAY_IN.forEach((s, i) => {
    add('in' + i, 'rect', {}, { x: IN[i].x, y: 170, w: 0, h: 96, rx: 6, fill: s[2], fo: 0.85, o: 0 });
    const wide = IN[i].w > 200;
    add('inL' + i, 'text', { size: wide ? 30 : 24, anchor: wide ? 'middle' : 'end', weight: 800 },
      { x: wide ? IN[i].mid : BX + BW, y: wide ? 230 : 362 + (i - 2) * 44, content: `${s[0]} ${fmt(s[1])}`, fill: wide ? '#06101c' : s[2], o: 0 });
  });
  // what kind of pay each is
  add('tTax', 'text', { size: 26, anchor: 'middle', weight: 700 }, { x: IN[0].mid, y: 312, content: 'Taxed', fill: C.soft, o: 0 });
  add('tFree', 'text', { size: 26, anchor: 'middle', weight: 700 }, { x: (IN[1].x + IN[2].x + IN[2].w) / 2, y: 312, content: 'Allowances: not taxed', fill: C.green, o: 0 });

  // ---- where it goes
  add('outHead', 'text', { size: 40, anchor: 'start', weight: 800 }, { x: BX, y: 525, content: 'Where it goes', fill: C.ink, o: 0 });
  const OU = segs(OUT, GROSS);
  OUT.forEach((s, i) => {
    add('out' + i, 'rect', {}, { x: OU[i].x, y: 552, w: 0, h: 96, rx: 6, fill: s[2], fo: 0.85, o: 0 });
    const wide = OU[i].w > 300;
    add('outL' + i, 'text', { size: wide ? 30 : 24, anchor: wide ? 'middle' : 'end', weight: 800 },
      { x: wide ? OU[i].mid : BX + BW, y: wide ? 610 : 692, content: `${s[0]} ${fmt(s[1])}`, fill: wide ? '#06101c' : s[2], o: 0 });
  });
  add('outPct', 'text', { size: 64, anchor: 'start', weight: 850 }, { x: BX, y: 846, content: '50% saved and invested', fill: C.green, o: 0 });
  add('outGuess', 'text', { size: 30, anchor: 'start', weight: 600 }, { x: BX, y: 888, content: '', fill: C.soft, o: 0 });

  // ---- the line items
  const ROW = 56, maxA = 2088.99, LW = 300;
  add('sHead', 'text', { size: 34, anchor: 'start', weight: 800 }, { x: 110, y: 150, content: 'Saving and investing  $5,398', fill: C.green, o: 0 });
  SAVE.forEach((r, i) => {
    const y = 210 + i * ROW * 1.3;
    add('sL' + i, 'text', { size: 27, anchor: 'start', weight: 650 }, { x: 110, y, content: r[0], fill: C.ink, o: 0 });
    add('sV' + i, 'text', { size: 27, anchor: 'end', weight: 800, mono: true }, { x: 740, y, content: fmt(r[1]), fill: C.ink, o: 0 });
    add('sB' + i, 'rect', {}, { x: 110, y: y + 12, w: 0, h: 14, rx: 7, fill: C.green, o: 0, wTo: r[1] / maxA * 630 });
  });
  add('lHead', 'text', { size: 34, anchor: 'start', weight: 800 }, { x: 860, y: 150, content: 'Living  $3,991', fill: C.amber, o: 0 });
  LIVE.forEach((r, i) => {
    const y = 210 + i * ROW * 1.12;
    add('lL' + i, 'text', { size: 26, anchor: 'start', weight: 650 }, { x: 860, y, content: r[0], fill: C.ink, o: 0 });
    add('lV' + i, 'text', { size: 26, anchor: 'end', weight: 800, mono: true }, { x: 1490, y, content: fmt(r[1]), fill: C.ink, o: 0 });
    add('lB' + i, 'rect', {}, { x: 860, y: y + 10, w: 0, h: 12, rx: 6, fill: C.amber, o: 0, wTo: r[1] / maxA * 630 });
  });

  // ---- what the net worth is made of
  add('wHead', 'text', { size: 44, anchor: 'start', weight: 800 }, { x: BX, y: 190, content: 'Net worth today: ' + fmt(NOW), fill: C.ink, o: 0 });
  const WO = segs(WORTH, NOW);
  let small = 0;
  WORTH.forEach((s, i) => {
    add('w' + i, 'rect', {}, { x: WO[i].x, y: 250, w: 0, h: 120, rx: 6, fill: s[2], fo: 0.85, o: 0 });
    const wide = WO[i].w > 280;
    add('wL' + i, 'text', { size: wide ? 30 : 24, anchor: wide ? 'middle' : 'end', weight: 800 },
      { x: wide ? WO[i].mid : BX + BW, y: wide ? 322 : 420 + (small++) * 40, content: `${s[0]} ${fmt(s[1], { k: true })}`, fill: wide ? '#06101c' : s[2], o: 0 });
  });
  add('wBig', 'text', { size: 76, anchor: 'start', weight: 850 }, { x: BX, y: 650, content: Math.round(198148 / NOW * 100) + '% of it is in the TSP', fill: C.green, o: 0 });
  add('wSub', 'text', { size: 32, anchor: 'start', weight: 600 }, { x: BX, y: 706, content: 'Mortgage left on the house: $144,500 at 6.625%, a 30 year VA loan.', fill: C.soft, o: 0 });

  // ---- the goal
  add('goalHead', 'text', { size: 46, anchor: 'start', weight: 800 }, { x: GX0, y: 120, content: 'Where I am headed', fill: C.ink, o: 0 });
  add('goalSub', 'text', { size: 28, anchor: 'start', weight: 600 }, { x: GX0, y: 166, content: 'Invested today: ' + fmt(INVESTED) + ', growing 7% a year after inflation.', fill: C.soft, o: 0 });
  add('gz', 'rect', {}, { x: GX0 - 10, y: gy(0) - 2, w: GX1 - GX0 + 20, h: 4, rx: 2, fill: C.soft, o: 0 });
  add('gm', 'rect', {}, { x: GX0 - 10, y: gy(1e6) - 1, w: GX1 - GX0 + 20, h: 2, rx: 1, fill: C.line, o: 0 });
  add('gml', 'text', { size: 24, anchor: 'end', weight: 600, mono: true }, { x: GX0 - 22, y: gy(1e6) + 8, content: '$1M', fill: C.faint, o: 0 });
  add('zlab', 'text', { size: 24, anchor: 'end', weight: 600, mono: true }, { x: GX0 - 22, y: gy(0) + 8, content: '$0', fill: C.faint, o: 0 });
  [2019, 2026, 2033, 2040, 2047].forEach((yr) => add('gyr' + yr, 'text', { size: 24, anchor: 'middle', weight: 600, mono: true }, { x: gx(yr), y: GY0 + 52, content: String(yr), fill: C.faint, o: 0 }));
  add('gh', 'path', { d: GHIST }, { stroke: C.green, sw: 7, draw: 0 });
  add('gnow', 'text', { size: 26, anchor: 'start', weight: 800, mono: true }, { x: gx(2026.9) + 18, y: gy(NOW) + 46, content: 'Now', fill: C.green, o: 0 });
  [['k', KEEP, C.amber, 'Keep investing'], ['x', STOP, C.cyan, 'Never invest another dollar']].forEach(([k, P, col, name]) => {
    add('gp' + k, 'path', { d: pathOf(P.pts) }, { stroke: col, sw: 6, draw: 0 });
    add('gd' + k, 'dot', {}, { x: gx(P.hit), y: gy(1e6), r: 13, fill: col, stroke: C.panel, sw: 4, o: 0, s: 0.2 });
    add('gt' + k, 'text', { size: 28, anchor: 'end', weight: 800 }, { x: gx(P.hit) - 20, y: gy(1e6) + (k === 'k' ? -64 : 335), content: name, fill: col, o: 0 });
    add('gy' + k, 'text', { size: 28, anchor: 'end', weight: 800, mono: true }, { x: gx(P.hit) - 20, y: gy(1e6) + (k === 'k' ? -30 : 371), content: `$1M in ${Math.floor(P.hit)}, age ${age(P.hit)}`, fill: col, o: 0 });
  });

  // ---- what I put in the TSP each year
  add('tspHead', 'text', { size: 40, anchor: 'middle', weight: 800 }, { x: 800, y: 120, content: 'What I put in the TSP each year', fill: C.ink, o: 0 });
  add('tspSub', 'text', { size: 26, anchor: 'middle', weight: 600 }, { x: 800, y: 164, content: 'From my W-2s, and the share of my base pay it was', fill: C.soft, o: 0 });
  const TB = 700, TH = 400;
  TSP_IN.forEach(([yr, amt, base, rank], i) => {
    const x = 800 + (i - 2) * 220, h = Math.max(4, amt / 23500 * TH);
    add('tspB' + i, 'rect', {}, { x: x - 60, y: TB, w: 120, h: 0, rx: 8, fill: amt >= 22500 ? C.green : amt ? C.amber : C.red, o: 0, hTo: h });
    add('tspV' + i, 'text', { size: 28, anchor: 'middle', weight: 800, mono: true }, { x, y: TB - h - 52, content: amt ? fmt(amt, { k: true }) : '$0', fill: C.ink, o: 0 });
    add('tspP' + i, 'text', { size: 24, anchor: 'middle', weight: 700 }, { x, y: TB - h - 18, content: `${Math.round(amt / base * 100)}%`, fill: amt >= 22500 ? C.green : C.soft, o: 0 });
    if (amt >= 22500) add('tspM' + i, 'text', { size: 26, anchor: 'middle', weight: 850, mono: true }, { x, y: TB - h + 42, content: 'MAX', fill: '#06101c', o: 0 });
    add('tspY' + i, 'text', { size: 26, anchor: 'middle', weight: 700, mono: true }, { x, y: TB + 40, content: String(yr), fill: C.faint, o: 0 });
    add('tspR' + i, 'text', { size: 24, anchor: 'middle', weight: 800 }, { x, y: TB + 76, content: rank, fill: C.amber, o: 0 });
  });

  // ---- what I earned vs what I have
  const KW = 1280, kx = 160;
  add('kHead', 'text', { size: 40, anchor: 'start', weight: 800 }, { x: kx, y: 140, content: 'What I earned vs what I have', fill: C.ink, o: 0 });
  add('kEl', 'text', { size: 28, anchor: 'start', weight: 700 }, { x: kx, y: 236, content: 'All my base pay, June 2020 to now (W-2s)', fill: C.soft, o: 0 });
  add('kE', 'rect', {}, { x: kx, y: 256, w: 0, h: 90, rx: 8, fill: C.cyan, fo: 0.85, o: 0 });
  add('kEv', 'text', { size: 36, anchor: 'end', weight: 850, mono: true }, { x: kx + KW - 24, y: 314, content: fmt(LIFETIME), fill: '#06101c', o: 0 });
  add('kHl', 'text', { size: 28, anchor: 'start', weight: 700 }, { x: kx, y: 436, content: 'My net worth today', fill: C.soft, o: 0 });
  add('kH', 'rect', {}, { x: kx, y: 456, w: 0, h: 90, rx: 8, fill: C.green, fo: 0.85, o: 0 });
  add('kHv', 'text', { size: 36, anchor: 'end', weight: 850, mono: true }, { x: kx + KW * NOW / LIFETIME - 24, y: 514, content: fmt(NOW), fill: '#06101c', o: 0 });
  add('kBig', 'text', { size: 60, anchor: 'start', weight: 850, maxw: 1300 }, { x: kx, y: 680, content: `${Math.round(NOW / LIFETIME * 100)} cents of every dollar, still here`, fill: C.green, o: 0 });
  add('kSub', 'text', { size: 30, anchor: 'start', weight: 600, maxw: 1300 }, { x: kx, y: 740, content: 'That\'s after taxes, a house, two cars, pets and a family.', fill: C.soft, o: 0 });

  // ---- what I got wrong, what I got right
  add('mHead', 'text', { size: 44, anchor: 'start', weight: 850 }, { x: 120, y: 120, content: 'What I got wrong', fill: C.ink, o: 0 });
  [['Trying to impress people with money', 'instead of just being myself.'],
   ['Not investing right away as a 2d Lt', 'Every month you wait is growth you never get back.'],
   ['Being so frugal it hurt my family', 'Now we spend on our pets and my wife\'s guilt-free money.']].forEach(([a, b], i) => {
    const y = 170 + i * 210;
    add('mR' + i, 'rect', {}, { x: 100, y, w: 1400, h: 180, rx: 22, fill: C.panel2, stroke: C.red, sw: 3, o: 0 });
    add('mN' + i, 'text', { size: 64, anchor: 'middle', weight: 850, mono: true }, { x: 180, y: y + 114, content: String(i + 1), fill: C.red, o: 0 });
    add('mA' + i, 'text', { size: 40, anchor: 'start', weight: 800, maxw: 1180 }, { x: 260, y: y + 78, content: a, fill: C.ink, o: 0 });
    add('mB' + i, 'text', { size: 30, anchor: 'start', weight: 600, maxw: 1180 }, { x: 260, y: y + 136, content: b, fill: C.soft, o: 0 });
  });

  add('wnHead', 'text', { size: 44, anchor: 'start', weight: 850 }, { x: 120, y: 120, content: 'What I got right: keep the big things small', fill: C.ink, o: 0 });
  [['HOME', '2 bed, 1 bath in Nevada, Iowa'], ['CAR', '2021 Hyundai Venue: paid off in 6 months, 60,000 miles'], ['CAR', '2006 Toyota Avalon from my grandma, 115,000 miles']].forEach(([a, b], i) => {
    const y = 230 + i * 110;
    add('wnA' + i, 'text', { size: 28, anchor: 'start', weight: 800, mono: true }, { x: 140, y: y + 40, content: a, fill: C.green, o: 0 });
    add('wnB' + i, 'text', { size: 36, anchor: 'start', weight: 700, maxw: 1150 }, { x: 300, y: y + 40, content: b, fill: C.ink, o: 0 });
  });
  add('wnBig', 'text', { size: 46, anchor: 'middle', weight: 850, maxw: 1400 }, { x: 800, y: 640, content: 'If the big things are in check,', fill: C.green, o: 0 });
  add('wnBig2', 'text', { size: 46, anchor: 'middle', weight: 850, maxw: 1400 }, { x: 800, y: 700, content: 'the little things don\'t hurt.', fill: C.green, o: 0 });
  add('wnQ', 'text', { size: 30, anchor: 'middle', weight: 650, maxw: 1400 }, { x: 800, y: 820, content: 'Freedom is bought with hard work and discipline over many years.', fill: C.amber, o: 0 });

  const hide = (s, ids) => ids.forEach((id) => { s[id].o = 0; });
  const ids = (pre) => all.filter((id) => id.startsWith(pre));

  // ================================================================ steps
  S.step({ head: 'What did you find?', body: 'Before class you worked out what a brand new 2d Lt makes. **Did you get $6,062.68?** If not, no big deal, let\'s look at it.', go: [800, 640, 900, 290, 'How does that compare?'] })
    .beat(0.6, (s) => { s.hwHead.o = 1; s.hwSub.o = 1; })
    .beat(1.4, (s) => { HW.forEach((_, i) => { s['hwL' + i].o = 1; s['hwV' + i].o = 1; }); }, (id) => { const m = /^hw[LV](\d)$/.exec(id); return m ? { w: [+m[1] / 3, (+m[1] + 1) / 3] } : null; })
    .beat(0.5, (s) => { s.hwRule.o = 1; s.hwRule.w = 1080; })
    .beat(1.4, (s) => { s.hwM.o = 1; s.hwM.num = 6062.68; s.hwML.o = 1; })
    .beat(0.6, (s) => { s.hwY.o = 1; });

  S.step({ head: 'Now compare it', body: 'Same base, same pay tables. **Check out the last two bars.**', go: [800, 485, 1420, 610, 'What that means'] })
    .beat(0.7, (s) => { all.forEach((i) => { s[i].o = 0; }); s.oeHead.o = 1; s.oeSub.o = 1; s.oeKey.o = 1; s.oeKey2.o = 1; })
    .beat(2.2, (s) => { OE.forEach(([, , ov, , ev], i) => { s['oeO' + i].o = 1; s['oeO' + i].h = oh(ov); s['oeO' + i].y = OB - oh(ov); s['oeE' + i].o = 1; s['oeE' + i].h = oh(ev); s['oeE' + i].y = OB - oh(ev);
        ['Ov', 'Ev', 'G', 'Y'].forEach((k) => { s['oe' + k + i].o = 1; }); }); },
      (id) => { const m = /^oe(O|E|Ov|Ev|G|Y)(\d)$/.exec(id); return m ? { w: [+m[2] / 6, (+m[2] + 2) / 6] } : null; })
    .beat(1.0, (s) => { s.oeE8.o = 1; s.oeE8.h = oh(E8); s.oeE8.y = OB - oh(E8); s.oeE8v.o = 1; s.oeE8g.o = 1; s.oeE8y.o = 1; })
    .beat(0.9, (s) => { s.oeLine.o = 1; s.oeLine.w = ex8 + 60 - (ogx(3) - 100); })
    .beat(0.7, (s) => { s.oeBig.o = 1; s.oeBig2.o = 1; });

  S.step({ head: 'Lead with it', body: 'This one is really about leadership.', go: [800, 480, 1420, 600, 'So what do I do with mine?'] })
    .beat(0.7, (s) => { all.forEach((i) => { s[i].o = 0; }); })
    .beat(0.9, (s) => { s.ldQ1.o = 1; })
    .beat(0.8, (s) => { s.ldA.o = 1; s.ldB.o = 1; }, (id) => (id === 'ldB' ? { w: [0.4, 1] } : null))
    .beat(0.9, (s) => { s.ldC.o = 1; s.ldD.o = 1; });

  S.step({ head: 'Avoid lifestyle inflation', body: 'You already know how to live on a cadet budget, so keep doing it for a while. **Every time you get a raise, bank whatever is above that baseline.**', go: [800, 480, 1300, 600, 'Here is my story'] })
    .beat(0.7, (s) => { all.forEach((i) => { s[i].o = 0; }); s.liHead.o = 1; s.liAl.o = 1; })
    .beat(1.0, (s) => { s.liA.o = 1; s.liA.w = LWD * LB / LP; s.liAv.o = 1; })
    .beat(0.4, (s) => { s.liBl.o = 1; })
    .beat(1.0, (s) => { s.liB.o = 1; s.liB.w = LWD * LB / LP; })
    .beat(1.0, (s) => { s.liX.o = 1; s.liX.w = LWD * (1 - LB / LP); s.liXv.o = 1; })
    .beat(0.8, (s) => { s.liBig.o = 1; })
    .beat(0.8, (s) => { s.liSub.o = 1; s.liSub2.o = 1; });

  S.step({ head: 'This was me in 2019.', body: 'Fresh out of college with student loans.', go: [800, 380, 760, 170, 'What happened next?'] })
    .beat(0.5, (s) => { all.forEach((i) => { s[i].o = 0; }); s.bigYr.o = 1; })
    .beat(1.0, (s) => { s.big.o = 1; s.big.s = 1; })
    .beat(0.7, (s) => { s.bigSub.o = 1; });

  S.step({ head: 'This is me today.', body: 'I get paid the same as every other captain. **I didn\'t inherit anything or win the lottery.**', go: [800, 380, 860, 170, 'Show me how'] })
    .beat(0.4, (s) => { s.bigSub.o = 0; s.bigYr.content = 'November 2026'; })
    .beat(2.4, (s) => { s.big.num = NOW; s.big.fill = C.green; s.big.s = 1.08; });

  S.step({ head: 'Years 1 to 3: digging out', body: 'Commissioned in June 2019, then a year\'s wait. On active duty in June 2020, owing **$24,920** in student loans. I paid off a car in 6 months and the loans by 2022.', go: [xOf(2021), yOf(-3500), 120, 120, 'Keep going'] })
    .beat(0.8, (s) => { hide(s, ['big', 'bigYr']); ids('g').filter((i) => /^g(l)?(-?\d)/.test(i)).forEach((i) => { s[i].o = 1; }); for (let y = 2019; y <= 2026; y++) s['yr' + y].o = 1; })
    .beat(0.4, (s) => { s.p0.o = 1; s.p0.s = 1; s.pv0.o = 1; })
    .beat(1.6, (s) => { s.l1.draw = 1; [1, 2].forEach((i) => { s['p' + i].o = 1; s['p' + i].s = 1; s['pv' + i].o = 1; }); }, (id) => (id === 'p2' || id === 'pv2' ? { w: [0.6, 1] } : id === 'p1' || id === 'pv1' ? { w: [0.2, 0.6] } : null));

  S.step({ head: '2022: crossing zero', body: 'Loans paid off. From here on, my money finally started working for me.', go: [xOf(2022), yOf(24000), 120, 120, 'Keep going'] })
    .beat(1.0, (s) => { s.l2.draw = 1; s.p3.o = 1; s.p3.s = 1.3; s.pv3.o = 1; })
    .beat(0.6, (s) => { s.p3.s = 1; s.zeroTag.o = 1; });

  S.step({ head: 'Then the curve bends', body: 'I didn\'t do anything fancy. Same plan every year, and the line just keeps getting steeper.', go: [xOf(2026.9) - 30, yOf(NOW) + 10, 140, 120, 'Why does it bend?'] })
    .beat(2.6, (s) => { s.l3.draw = 1; s.area.o = 1; for (let i = 4; i < PTS.length; i++) { s['p' + i].o = 1; s['p' + i].s = 1; s['pv' + i].o = 1; } },
      (id) => { const m = /^pv?(\d)$/.exec(id); return m && +m[1] >= 4 ? { w: [(+m[1] - 4) / 5, (+m[1] - 3) / 5] } : null; });

  S.step({ head: 'Each year adds more than the last', body: 'Your investments make money, and then **that money makes money too**. That\'s compounding.', go: [800, 520, 1300, 600, 'What did I put in?'] })
    .beat(0.8, (s) => { all.forEach((i) => { s[i].o = 0; }); s.gainHead.o = 1; })
    .beat(2.4, (s) => { all.filter((i) => /^g[bvy]\d$/.test(i)).forEach((i) => { s[i].o = 1; }); NW.slice(1, -1).forEach((_, i) => { const g = NW[i + 1][1] - NW[i][1]; s['gb' + i].h = g / 70000 * 430; s['gb' + i].y = 760 - g / 70000 * 430; }); },
      (id) => { const m = /^g[bvy](\d)$/.exec(id); return m ? { w: [+m[1] / 8, (+m[1] + 2) / 8] } : null; });

  S.step({ head: 'What I put in', body: 'Every time I promoted, more went in. **Since 2023 I\'ve maxed it out.**', go: [800, 500, 1300, 580, 'Earned vs kept'] })
    .beat(0.7, (s) => { all.forEach((i) => { s[i].o = 0; }); s.tspHead.o = 1; s.tspSub.o = 1; })
    .beat(2.2, (s) => { TSP_IN.forEach(([, amt], i) => { const h = Math.max(4, amt / 23500 * 400); s['tspB' + i].o = 1; s['tspB' + i].h = h; s['tspB' + i].y = 700 - h; ['V', 'P', 'Y', 'R', 'M'].forEach((k) => { if (s['tsp' + k + i]) s['tsp' + k + i].o = 1; }); }); },
      (id) => { const m = /^tsp[BVPYRM](\d)$/.exec(id); return m ? { w: [+m[1] / 8, (+m[1] + 2) / 8] } : null; })

  S.step({ head: 'Earned vs kept', body: 'Every dollar of base pay I\'ve been paid since 2020, next to what I have today.', go: [800, 470, 1340, 650, 'Now, the budget'] })
    .beat(0.7, (s) => { all.forEach((i) => { s[i].o = 0; }); s.kHead.o = 1; s.kEl.o = 1; })
    .beat(1.2, (s) => { s.kE.o = 1; s.kE.w = KW; s.kEv.o = 1; })
    .beat(0.5, (s) => { s.kHl.o = 1; })
    .beat(1.4, (s) => { s.kH.o = 1; s.kH.w = KW * NOW / LIFETIME; s.kHv.o = 1; })
    .beat(0.8, (s) => { s.kBig.o = 1; s.kSub.o = 1; });

  S.step({ head: 'Your guess', body: 'Tap the share of my paycheck you think goes to saving and investing.',
    act(ctx) {
      CH.forEach((c, i) => ctx.hit(480 + i * 320, 515, 250, 180, c, () => ctx.done({ guess: c }), 'quiet'));
    } })
    .beat(0.8, (s) => { all.forEach((i) => { s[i].o = 0; }); })
    .beat(0.8, (s) => { s.qHead.o = 1; [0, 1, 2].forEach((i) => { s['ch' + i].o = 1; s['cht' + i].o = 1; }); });

  S.step({ head: 'What comes in', body: '**Base pay** is taxed. **BAH** (housing) and **BAS** (food) are allowances, and they are not taxed. The **TSP match** is the BRS at work.', go: [800, 290, 1320, 260, 'Where does it go?'] })
    .beat(0.6, (s) => { s.qHead.o = 0; [0, 1, 2].forEach((i) => { s['ch' + i].o = 0; s['cht' + i].o = 0; }); s.inHead.o = 1; s.inSub.o = 1; })
    .beat(1.6, (s) => { PAY_IN.forEach((p, i) => { s['in' + i].o = 1; s['in' + i].w = IN[i].w - 3; s['inL' + i].o = 1; }); }, (id) => { const m = /^inL?(\d)$/.exec(id); return m ? { w: [+m[1] / 5, (+m[1] + 2) / 5] } : null; })
    .beat(0.7, (s) => { s.tTax.o = 1; s.tFree.o = 1; });

  S.step({ head: 'Where it goes', body: 'About half of it, before I spend anything. Saving comes out first and we live on what\'s left.', go: [800, 628, 1320, 170, 'Show the line items'] })
    .beat(1.6, (s) => { s.outHead.o = 1; OUT.forEach((p, i) => { s['out' + i].o = 1; s['out' + i].w = OU[i].w - 3; s['outL' + i].o = 1; }); }, (id) => { const m = /^outL?(\d)$/.exec(id); return m ? { w: [+m[1] / 4, (+m[1] + 2) / 4] } : null; })
    .beat(0.8, (s) => { s.outPct.o = 1; s.outGuess.o = 1; s.outGuess.content = st.guess ? (st.guess === '50%' ? 'You guessed 50%. Spot on.' : `You guessed ${st.guess}.`) : ''; });

  S.step({ head: 'The line items', body: 'This is my actual October budget, straight from my spreadsheet.', go: [425, 385, 680, 390, 'What it adds up to'] })
    .beat(0.7, (s) => { all.forEach((i) => { s[i].o = 0; }); })
    .beat(2.2, (s) => { s.sHead.o = 1; s.lHead.o = 1;
      SAVE.forEach((r, i) => { s['sL' + i].o = 1; s['sV' + i].o = 1; s['sB' + i].o = 1; s['sB' + i].w = r[1] / maxA * 630; });
      LIVE.forEach((r, i) => { s['lL' + i].o = 1; s['lV' + i].o = 1; s['lB' + i].o = 1; s['lB' + i].w = r[1] / maxA * 630; }); },
    (id) => { const m = /^([sl])[LVB](\d)$/.exec(id); if (!m) return null; const k = +m[2] / (m[1] === 's' ? 5 : 10); return { w: [k * 0.7, k * 0.7 + 0.3] }; });

  S.step({ head: 'What it adds up to', body: 'The TSP did most of the heavy lifting. Chapter 3 gets into why.', go: [800, 660, 1320, 140, 'Where am I headed?'] })
    .beat(0.7, (s) => { all.forEach((i) => { s[i].o = 0; }); s.wHead.o = 1; })
    .beat(1.6, (s) => { WORTH.forEach((p, i) => { s['w' + i].o = 1; s['w' + i].w = Math.max(2, WO[i].w - 3); s['wL' + i].o = 1; }); }, (id) => { const m = /^wL?(\d)$/.exec(id); return m ? { w: [+m[1] / 7, (+m[1] + 2) / 7] } : null; })
    .beat(0.8, (s) => { s.wBig.o = 1; s.wSub.o = 1; });

  S.step({ head: 'Where I am headed', body: 'If I keep maxing the TSP and both Roth IRAs, **I hit $1 million at ' + age(KEEP.hit) + '**, in today\'s dollars.', go: [gx(KEEP.hit) - 80, gy(1e6) - 10, 300, 150, 'And if I stopped today?'] })
    .beat(0.7, (s) => { all.forEach((i) => { s[i].o = 0; }); ['goalHead', 'goalSub', 'gz', 'gm', 'gml', 'zlab'].forEach((i) => { s[i].o = 1; }); [2019, 2026, 2033, 2040, 2047].forEach((y) => { s['gyr' + y].o = 1; }); })
    .beat(1.2, (s) => { s.gh.o = 1; s.gh.draw = 1; s.gnow.o = 1; })
    .beat(1.6, (s) => { s.gpk.o = 1; s.gpk.draw = 1; })
    .beat(0.6, (s) => { s.gdk.o = 1; s.gdk.s = 1; s.gtk.o = 1; s.gyk.o = 1; });

  S.step({ head: 'I\'ve already won the game', body: 'Even if I never put in another dollar, what\'s already there **gets to $1 million on its own**. That\'s why the early years matter so much.', go: [gx(STOP.hit) - 80, gy(1e6), 300, 150, 'What did I get wrong?'] })
    .beat(2.2, (s) => { s.gpx.o = 1; s.gpx.draw = 1; })
    .beat(0.7, (s) => { s.gdx.o = 1; s.gdx.s = 1; s.gtx.o = 1; s.gyx.o = 1; });

  S.step({ head: 'What I got wrong', body: 'I made plenty. Here are three you can skip. **It\'s not always about the spreadsheet.**', go: [800, 475, 1420, 640, 'What did I get right?'] })
    .beat(0.7, (s) => { all.forEach((i) => { s[i].o = 0; }); s.mHead.o = 1; })
    .beat(2.0, (s) => { [0, 1, 2].forEach((i) => { ['R', 'N', 'A', 'B'].forEach((k) => { s['m' + k + i].o = 1; }); }); },
      (id) => { const m = /^m[RNAB](\d)$/.exec(id); return m ? { w: [+m[1] / 3, (+m[1] + 1) / 3] } : null; });

  S.step({ head: 'What I got right', body: 'We\'ve saved about **50%** of our income for years, and that\'s what gives us options. **Up next, Chapter 2: your first paycheck.**' })
    .beat(0.7, (s) => { all.forEach((i) => { s[i].o = 0; }); s.wnHead.o = 1; })
    .beat(1.6, (s) => { [0, 1, 2].forEach((i) => { s['wnA' + i].o = 1; s['wnB' + i].o = 1; }); }, (id) => { const m = /^wn[AB](\d)$/.exec(id); return m ? { w: [+m[1] / 3, (+m[1] + 1) / 3] } : null; })
    .beat(0.9, (s) => { s.wnBig.o = 1; s.wnBig2.o = 1; })
    .beat(0.8, (s) => { s.wnQ.o = 1; });

  return S;
}

FR.SCENES = FR.SCENES || {};
FR.SCENES.fr1 = scene;
})();
