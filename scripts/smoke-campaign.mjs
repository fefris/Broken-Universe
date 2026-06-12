// Campaign flow smoke test: new campaign -> hub tabs -> assault -> quick
// battle -> results -> back at hub with the turn advanced.
// Run with the dev server up: node scripts/smoke-campaign.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const OUT = 'scripts/out';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:5173/?quick=1', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/c1-title.png` });

page.on('dialog', (d) => d.accept());
await page.click('#btn-campaign-new');
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/c2-map.png` });

// Tabs render without errors.
await page.click('button[data-tab="garage"]');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/c3-garage.png` });
await page.click('button[data-tab="hero"]');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/c4-hero.png` });
await page.click('button[data-tab="map"]');
await page.waitForTimeout(300);

// Pick the crossroads and launch an assault.
await page.click('.map-node[data-id="crossroads"]');
await page.waitForTimeout(200);
await page.click('#btn-attack');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/c5-picker.png` });
const pickerOk = await page.evaluate(() => {
  const btn = document.getElementById('p-launch');
  return btn && !btn.disabled;
});
await page.click('#p-launch');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/c6-battle.png` });

// Quick battles run 60s; wait for the end screen then continue.
await page.waitForSelector('#endscreen', { state: 'visible', timeout: 90000 });
await page.screenshot({ path: `${OUT}/c7-endscreen.png` });
await page.click('#btn-menu');
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/c8-results.png` });
const resultsVisible = await page.evaluate(() => document.querySelector('.results-table') !== null);
await page.click('#r-continue');
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/c9-hub-after.png` });

const after = await page.evaluate(() => {
  const profile = JSON.parse(localStorage.getItem('broken-universe-profile-v1'));
  return {
    turn: profile.campaign.turn,
    credits: profile.credits,
    heroXp: profile.heroXp,
    unitXp: profile.units.reduce((s, u) => s + u.xp, 0),
    log: profile.campaign.log.slice(-2),
  };
});

console.log('picker valid:', pickerOk);
console.log('results table:', resultsVisible);
console.log('after battle:', JSON.stringify(after, null, 2));
console.log('console errors:', errors.length ? errors : 'none');

const ok =
  pickerOk && resultsVisible && after.turn === 2 && after.unitXp > 0 && errors.length === 0;
await browser.close();
console.log(ok ? 'CAMPAIGN SMOKE OK' : 'CAMPAIGN SMOKE FAILED');
process.exit(ok ? 0 : 1);
