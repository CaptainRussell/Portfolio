/* chars.js: the characters cadets pick on their phones, in the Practicum Adventure 8-bit style.
 * The AFAS 3410 class (the AS300s, Condon-Matzke, Estes and Martinez, and civilian students Graybill, Gulino and Nordstrom, whose photos he supplied) and Lt Col Cacic use their Storm HQ org chart photos (assets/people/<key>.jpg, 160 px;
 * Captain Russell, 25 Nov 2026: their normal pictures). The six Students (numbered, for anyone not listed) get a drawn 12 x 12 8-bit avatar in the
 * Practicum Adventure style (all men, light skin, per Captain Russell) and type their own name.
 * FRChars.list        [{id, name, img, kind: 'cadet' | 'cadre' | 'guest'}]
 * FRChars.get(id)     one of them
 * FRChars.src(id)     the picture's URL (a data: URL for guests)
 * FRChars.RANKS       the promotion ladder for the scoreboard: [{rank, at, file, ar}]
 * FRChars.rankOf(pts) the rank a score has earned
 * Code organized with help from Claude (Anthropic), Nov 2026.
 */
(function (root) {
  'use strict';
  const BASE = (document.currentScript && document.currentScript.src || '').replace(/live\/chars\.js.*$/, 'assets/');
  const CADETS = [['AshbackerMiloK', 'Milo Ashbacker'], ['BarszczCadenN', 'Caden Barszcz'], ['BourekAkrynJ', 'Akryn Bourek'], ['BradleeColinR', 'Colin Bradlee'],
    ['CollierJonathanG', 'Jonathan Collier'], ['CondonMatzkeIsabella', 'Isabella Condon-Matzke'], ['CooperTylerL', 'Tyler Cooper'], ['CoulthardNikalo', 'Nikalo Coulthard'], ['CurtisRobertT', 'Robert Curtis'],
    ['DavilaJoaquinD', 'Joaquin Davila'], ['DavisMartiG', 'Marti Davis'], ['EstesIsellaM', 'Isella Estes'], ['GaulStephenJ', 'Stephen Gaul'], ['GraybillTyler', 'Tyler Graybill'], ['GulinoAnthony', 'Anthony Gulino'], ['HaderAshtenM', 'Ashten Hader'],
    ['HelleNicolasD', 'Nicolas Helle'], ['HumistonVictoriaR', 'Victoria Humiston'], ['JalodiaAnika', 'Anika Jalodia'], ['MarschangAllissaA', 'Allissa Marschang'], ['MartinezToddM', 'Todd Martinez'], ['NordstromCaleb', 'Caleb Nordstrom'],
    ['TuMicahJ', 'Micah Tu'], ['VanDevanderDonC', 'Don Van Devander']];
  // guests: Practicum Adventure's preset avatars (practicum-adventure/data.js AVATARS)
  const GUESTS = [
    { id: 'g-pilot', name: 'Student 1', skin: '#f2c9a0', hair: '#6b4423', style: 'none', acc: 'pilot', shirt: '#2f4f9f' },
    { id: 'g-shades', name: 'Student 2', skin: '#f5d0b0', hair: '#111', style: 'buzz', acc: 'shades', shirt: '#556b2f' },
    { id: 'g-cap', name: 'Student 3', skin: '#ffdbac', hair: '#d4a017', style: 'short', acc: 'cap', shirt: '#7a2b2b' },
    { id: 'g-glasses', name: 'Student 4', skin: '#f1c27d', hair: '#a0522d', style: 'short', acc: 'glasses', shirt: '#2f4f9f' },
    { id: 'g-patrol', name: 'Student 5', skin: '#eac39b', hair: '#3b2a1a', style: 'buzz', acc: 'patrol', shirt: '#6b6a4a' },
    { id: 'g-beard', name: 'Student 6', skin: '#f5d0b0', hair: '#8a3b12', style: 'short', acc: 'beard', shirt: '#3d5a80' },
  ];
  function draw(a, i) {
    const c = document.createElement('canvas'); c.width = c.height = 12;
    const x = c.getContext('2d'), R = (col, px, py, w, h) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
    R(`hsl(${(i * 47 + 200) % 360},40%,22%)`, 0, 0, 12, 12);
    R(a.shirt, 1, 10, 10, 2); R('#ffd23f', 3, 10, 1, 1);
    R(a.skin, 3, 3, 6, 7); R(a.skin, 2, 5, 1, 2); R(a.skin, 9, 5, 1, 2);
    if (a.style === 'short') { R(a.hair, 3, 2, 6, 2); R(a.hair, 2, 3, 1, 2); R(a.hair, 9, 3, 1, 2); }
    if (a.style === 'buzz') R(a.hair, 3, 2, 6, 1);
    if (a.style === 'bun') { R(a.hair, 3, 2, 6, 2); R(a.hair, 5, 0, 2, 2); }
    if (a.style === 'puff') { R(a.hair, 2, 0, 8, 3); R(a.hair, 1, 1, 1, 3); R(a.hair, 10, 1, 1, 3); }
    R('#000', 4, 6, 1, 1); R('#000', 7, 6, 1, 1); R('#7a2b2b', 5, 8, 2, 1);
    switch (a.acc) {
      case 'shades': R('#000', 3, 5, 6, 2); R('#3fd8ff', 4, 5, 1, 1); R('#3fd8ff', 7, 5, 1, 1); break;
      case 'glasses': R('#ddd', 3, 5, 2, 2); R('#ddd', 7, 5, 2, 2); R('#000', 4, 6, 1, 1); R('#000', 7, 6, 1, 1); break;
      case 'beret': R('#2b6cb0', 2, 1, 8, 2); R('#2b6cb0', 8, 3, 2, 1); R('#ffd23f', 3, 2, 1, 1); break;
      case 'pilot': R('#6b4423', 2, 1, 8, 3); R('#9ad', 3, 4, 2, 1); R('#9ad', 7, 4, 2, 1); break;
      case 'cap': R('#1f3a6b', 3, 1, 6, 2); R('#1f3a6b', 2, 3, 9, 1); R('#fff', 5, 1, 2, 1); break;
      case 'patrol': R('#6b6a4a', 3, 1, 6, 2); R('#8a8761', 4, 1, 1, 1); R('#8a8761', 7, 2, 1, 1); R('#4f4e36', 2, 3, 8, 1); break;
      case 'beard': R(a.hair, 3, 7, 6, 3); R(a.hair, 2, 6, 1, 2); R(a.hair, 9, 6, 1, 2); R('#7a2b2b', 5, 8, 2, 1); R(a.skin, 4, 7, 4, 1); break;
    }
    return c.toDataURL();
  }
  const list = CADETS.map(([id, name]) => ({ id, name, kind: 'cadet', img: BASE + 'people/' + id + '.jpg' }));
  list.push({ id: 'CacicJohn', name: 'Lt Col Cacic', kind: 'cadre', img: BASE + 'people/CacicJohn.jpg' });
  let guestImgs = null;
  GUESTS.forEach((g) => list.push({ id: g.id, name: g.name, kind: 'guest', spec: g }));
  const byId = {}; list.forEach((c) => { byId[c.id] = c; });
  function src(id) {
    const c = byId[id]; if (!c) return '';
    if (c.img) return c.img;
    if (!guestImgs) { guestImgs = {}; GUESTS.forEach((g, i) => { guestImgs[g.id] = draw(g, i); }); }
    return guestImgs[id];
  }
  // promotions on the scoreboard (Captain Russell, 24 Nov 2026: use the Adventure game's rank insignia)
  const RANKS = [['2d Lt', 0, '2dLt', 0.4], ['1st Lt', 800, '1stLt', 0.4], ['Capt', 2000, 'Capt', 1.069], ['Maj', 3500, 'Maj', 0.953], ['Lt Col', 5200, 'LtCol', 0.953], ['Col', 7000, 'Col', 2.0]]
    .map(([rank, at, file, ar]) => ({ rank, at, file: BASE + 'insignia/' + file + '.svg', ar }));
  const rankOf = (pts) => RANKS.filter((r) => pts >= r.at).pop();
  root.FRChars = { list, get: (id) => byId[id], src, RANKS, rankOf, BASE };
})(this);
