// Screenshot every UI surface for visual review of the SG restyle.
// Run with dev server up: node scripts/shoot-ui.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const OUT = 'scripts/out/ui';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));
page.on('dialog', (d) => d.accept('Strike Team'));

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });

await page.goto('http://localhost:5173/?quick=1', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);

// 1. Title / main menu (open skirmish panel too for a fuller shot)
await shot('01-title');
await page.evaluate(() => {
  const d = document.querySelector('#skirmish-panel');
  if (d) d.open = true;
});
await page.waitForTimeout(300);
await shot('02-title-skirmish');

// 2. Campaign hub: war map
await page.click('#btn-campaign-new');
await page.waitForTimeout(700);
await shot('03-hub-map');
// select a province to populate the detail panel
await page.click('.map-node[data-id="crossroads"]');
await page.waitForTimeout(250);
await shot('04-hub-map-detail');

// 3. Garage
await page.click('button[data-tab="garage"]');
await page.waitForTimeout(500);
await shot('05-garage');
// open the add-part dropdown area by selecting a unit (first row already selected)
await page.evaluate(() => {
  const rows = document.querySelectorAll('.g-row');
  if (rows[2]) rows[2].click();
});
await page.waitForTimeout(300);
await shot('06-garage-unit');

// 4. Hero sheet
await page.click('button[data-tab="hero"]');
await page.waitForTimeout(400);
await shot('07-hero');

// 5. Squad picker (back to map, launch an assault)
await page.click('button[data-tab="map"]');
await page.waitForTimeout(250);
await page.click('.map-node[data-id="crossroads"]');
await page.waitForTimeout(150);
await page.click('#btn-attack');
await page.waitForSelector('#p-grid', { timeout: 5000 });
await page.waitForTimeout(300);
await shot('08-squad-picker');
// save a group to show the chips
await page.click('#p-savegroup');
await page.waitForTimeout(250);
await shot('09-squad-picker-group');

// 6. In-battle HUD
await page.click('#p-launch');
await page.waitForTimeout(3500);
await shot('10-battle-hud');

// 7. End screen + results (quick battles end ~60s)
await page.waitForSelector('#endscreen', { state: 'visible', timeout: 90000 });
await page.waitForTimeout(400);
await shot('11-endscreen');
await page.click('#btn-menu');
await page.waitForTimeout(600);
await shot('12-results');

console.log('console errors:', errors.length ? errors : 'none');
await browser.close();
console.log(errors.length ? 'UI SHOOT: errors present' : 'UI SHOOT OK');
process.exit(errors.length ? 1 : 0);
