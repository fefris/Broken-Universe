// Portal smoke test: the war map offers multiple attack borders, and the border
// you assault through decides which gate your force enters the battlefield from.
// Crossroads (5 gates) is attackable from Verdant Steps (SW) and Sunward Terrace
// (SE) at turn 1 — launching from each must spawn the attacker at a different gate.
// Run with the dev server up: node scripts/smoke-portals.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const OUT = 'scripts/out/portals';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));
page.on('dialog', (d) => d.accept());

/** New campaign, open the war map, select crossroads. Returns UI portal counts. */
async function openWarMapAndSelect() {
  await page.goto('http://localhost:5173/?quick=1', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.click('#btn-campaign-new');
  await page.waitForTimeout(500);
  await page.click('.map-node[data-id="crossroads"]');
  await page.waitForTimeout(200);
  return page.evaluate(() => ({
    contested: document.querySelectorAll('.portal.contested').length,
    active: document.querySelectorAll('.portal.active').length,
    sources: document.querySelectorAll('.atk-src').length,
  }));
}

/** Launch the crossroads assault from a given source border; read the attacker gate. */
async function launchFrom(sourceId, shot) {
  await openWarMapAndSelect();
  await page.click(`.atk-src[data-src="${sourceId}"]`);
  await page.waitForSelector('#p-grid', { timeout: 5000 });
  await page.click('#p-launch');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${shot}.png` });
  return page.evaluate(() => {
    const w = window.__bu.runner.world;
    const atk = w.spawnZones.find((z) => z.team === 0);
    const gate = w.portals.find(
      (p) => Math.abs(p.pos.x - atk.center.x) < 0.01 && Math.abs(p.pos.y - atk.center.y) < 0.01,
    );
    const def = w.spawnZones.find((z) => z.team === 1);
    return { gateId: gate?.id, nPortals: w.portals.length, atk: atk.center, def: def.center };
  });
}

const ui = await openWarMapAndSelect();
await page.screenshot({ path: `${OUT}/p0-warmap.png` });

const fromVerdant = await launchFrom('verdant', 'p1-from-verdant');
const fromTerrace = await launchFrom('terrace', 'p2-from-terrace');

console.log('war map UI:', JSON.stringify(ui));
console.log('from Verdant (SW):', JSON.stringify(fromVerdant));
console.log('from Terrace (SE):', JSON.stringify(fromTerrace));
console.log('console errors:', errors.length ? errors : 'none');

const ok =
  ui.contested >= 2 && // multiple borders you can attack from
  ui.active >= 2 && // the selected target's gates are highlighted
  ui.sources >= 2 &&
  fromVerdant.nPortals === 5 &&
  fromVerdant.gateId === 'sw' &&
  fromTerrace.gateId === 'se' &&
  (fromVerdant.atk.x !== fromTerrace.atk.x || fromVerdant.atk.y !== fromTerrace.atk.y) &&
  errors.length === 0;
await browser.close();
console.log(ok ? 'PORTALS SMOKE OK' : 'PORTALS SMOKE FAILED');
process.exit(ok ? 0 : 1);
