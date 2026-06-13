// Wave reinforcement smoke test: in a campaign assault, field a small first
// group, then verify reinforcements can be deployed from the remaining roster.
// Run with dev server up: node scripts/smoke-waves.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const OUT = 'scripts/out/waves';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));
page.on('dialog', (d) => d.accept());

await page.goto('http://localhost:5173/?quick=1', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);

await page.click('#btn-campaign-new');
await page.waitForTimeout(500);
await page.click('.map-node[data-id="crossroads"]');
await page.waitForTimeout(150);
await page.click('#btn-attack');
await page.waitForSelector('#p-grid', { timeout: 5000 });
await page.waitForTimeout(200);

// Field a SMALL first group: clear, then pick the first 3 unit cards.
// (Re-query each click — selecting re-renders the grid and detaches handles.)
await page.click('#p-clear');
await page.waitForTimeout(100);
for (let i = 0; i < 3; i++) {
  await page.locator('#p-grid .p-card').nth(i).click();
  await page.waitForTimeout(60);
}
await page.screenshot({ path: `${OUT}/w1-first-group.png` });
const firstGroup = await page.$$eval('#p-grid .p-card.picked', (n) => n.length);
await page.click('#p-launch');
await page.waitForTimeout(2500);

const beforeReinforce = await page.evaluate(() => {
  const w = window.__bu.runner.world;
  const c = w.commanders[0];
  return {
    fielded: c.squad.length,
    reservePool: c.reserves.length,
    alive: c.squad.filter((id) => w.units[id]?.alive).length,
  };
});
await page.screenshot({ path: `${OUT}/w2-battle.png` });

// Open the wave picker via the HUD button and deploy a fresh wave.
await page.click('.deploy-wave');
await page.waitForSelector('#w-grid', { timeout: 5000 });
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/w3-wave-picker.png` });
const waveCount = await page.locator('#w-grid .p-card').count();
for (let i = 0; i < Math.min(3, waveCount); i++) {
  await page.locator('#w-grid .p-card').nth(i).click();
  await page.waitForTimeout(60);
}
await page.waitForTimeout(100);
await page.click('#w-deploy');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/w4-after-deploy.png` });

const afterReinforce = await page.evaluate(() => {
  const w = window.__bu.runner.world;
  const c = w.commanders[0];
  return {
    fielded: c.squad.length,
    reservePool: c.reserves.length,
    alive: c.squad.filter((id) => w.units[id]?.alive).length,
  };
});

console.log('first group size:', firstGroup);
console.log('before reinforce:', JSON.stringify(beforeReinforce));
console.log('after reinforce:', JSON.stringify(afterReinforce));
console.log('console errors:', errors.length ? errors : 'none');

const ok =
  firstGroup === 3 &&
  beforeReinforce.fielded === 3 &&
  beforeReinforce.reservePool > 0 &&
  afterReinforce.fielded > beforeReinforce.fielded && // new units deployed
  afterReinforce.reservePool < beforeReinforce.reservePool && // pulled from reserve
  errors.length === 0;
await browser.close();
console.log(ok ? 'WAVES SMOKE OK' : 'WAVES SMOKE FAILED');
process.exit(ok ? 0 : 1);
