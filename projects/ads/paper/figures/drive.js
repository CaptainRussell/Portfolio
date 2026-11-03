const { chromium } = require('playwright');
(async () => {
  const [file, out] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1180, height: 1300 }, deviceScaleFactor: 3 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + file); await p.waitForTimeout(1200);
  await p.click('.tab[data-tab="drive"]'); await p.waitForTimeout(2500);
  const grid = await (await p.$('#hexv')).evaluateHandle(e => e.closest('.panel').querySelector('.grid'));
  const bb = await grid.boundingBox();
  for (const x of await p.$$('#hexv i.f')) { const t = await x.getAttribute('data-tip'); if (t && t.includes('Total sectors')) { await x.hover(); break; } }
  await p.waitForTimeout(900);
  const hl = await p.$$eval('#p-drive .hl', e => e.length);
  await p.screenshot({ path: out, clip: { x: bb.x - 6, y: bb.y - 6, width: bb.width + 12, height: bb.height + 12 } });
  console.log('grid', bb, 'highlighted', hl, 'errors', errs);
  await b.close();
})();
