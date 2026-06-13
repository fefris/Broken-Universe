// Squad-group smoke test: open the muster screen, save a group, change the
// muster, reload the group, confirm it restored. Run with dev server up:
// node scripts/smoke-groups.mjs
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
page.on('dialog', (d) => d.accept());

await page.goto('http://localhost:5173/?quick=1', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);

await page.click('#btn-campaign-new');
await page.waitForTimeout(500);
await page.click('.map-node[data-id="crossroads"]');
await page.waitForTimeout(150);
await page.click('#btn-attack');
await page.waitForSelector('#p-grid', { timeout: 5000 });
await page.waitForTimeout(200);

// Capture the auto-restored muster, save it as a group (inline form flow).
const initialPicks = await page.evaluate(() => document.querySelectorAll('.p-card.picked').length);
await page.click('#p-savegroup');
await page.waitForSelector('#p-groupname', { state: 'visible', timeout: 5000 });
await page.fill('#p-groupname', 'Alpha Strike');
await page.click('#p-groupsave');
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/g1-saved.png` });
const groupSavedInProfile = await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('broken-universe-profile-v1'));
  return p.squadGroups.map((g) => ({ name: g.name, n: g.uids.length }));
});

// Clear the muster, then reload the saved group.
await page.click('#p-clear');
await page.waitForTimeout(150);
const afterClear = await page.evaluate(() => document.querySelectorAll('.p-card.picked').length);
await page.click('.pg-load');
await page.waitForTimeout(200);
const afterReload = await page.evaluate(() => document.querySelectorAll('.p-card.picked').length);
await page.screenshot({ path: `${OUT}/g2-reloaded.png` });

console.log('initial picks:', initialPicks);
console.log('group saved:', JSON.stringify(groupSavedInProfile));
console.log('after clear:', afterClear, '| after reload:', afterReload);
console.log('console errors:', errors.length ? errors : 'none');

const ok =
  initialPicks > 0 &&
  groupSavedInProfile.length === 1 &&
  groupSavedInProfile[0].name === 'Alpha Strike' &&
  afterClear === 0 &&
  afterReload === initialPicks &&
  errors.length === 0;
await browser.close();
console.log(ok ? 'GROUPS SMOKE OK' : 'GROUPS SMOKE FAILED');
process.exit(ok ? 0 : 1);
