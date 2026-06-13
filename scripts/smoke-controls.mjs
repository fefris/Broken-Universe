// Controls smoke: WASD pans the camera, and right-clicking a move target issues
// the order (and drops a command ping). Run with the dev server up:
//   node scripts/smoke-controls.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const OUT = 'scripts/out/controls';
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
await page.waitForTimeout(600);

// Into a battle via a campaign assault (Crossroads from Verdant -> SW spawn).
await page.click('#btn-campaign-new');
await page.waitForTimeout(500);
await page.click('.map-node[data-id="crossroads"]');
await page.waitForTimeout(150);
await page.click('.atk-src[data-src="verdant"]');
await page.waitForSelector('#p-grid', { timeout: 5000 });
await page.click('#p-launch');
await page.waitForTimeout(2500);

const cam0 = await page.evaluate(() => {
  const c = window.__bu.renderer.camera;
  return { x: c.x, y: c.y };
});

// Hold D (pan right) then W (pan up); the camera position must change.
await page.mouse.move(800, 450); // make sure the canvas/window has focus context
await page.keyboard.down('d');
await page.waitForTimeout(450);
await page.keyboard.up('d');
const camD = await page.evaluate(() => ({ x: window.__bu.renderer.camera.x }));
await page.keyboard.down('w');
await page.waitForTimeout(450);
await page.keyboard.up('w');
const camW = await page.evaluate(() => ({ y: window.__bu.renderer.camera.y }));
await page.screenshot({ path: `${OUT}/ctrl1-panned.png` });

// Select a unit and right-click a destination -> a move order + ping.
const target = await page.evaluate(() => {
  const { runner, controls, renderer } = window.__bu;
  const c = runner.world.commanders[0];
  const uid = c.squad.find((id) => runner.world.units[id]?.alive);
  controls.selectOnly(uid);
  // A point ~120px right of screen centre, converted to a stable screen coord.
  return { uid, sx: renderer.camera.screenW / 2 + 120, sy: renderer.camera.screenH / 2 };
});
await page.mouse.click(target.sx, target.sy, { button: 'right' });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/ctrl2-move-ping.png` });

const order = await page.evaluate(
  (uid) => window.__bu.runner.world.units[uid]?.order?.kind,
  target.uid,
);

console.log('camera start:', JSON.stringify(cam0));
console.log('after D (expect x up):', JSON.stringify(camD));
console.log('after W (expect y down):', JSON.stringify(camW));
console.log('order after right-click:', order);
console.log('console errors:', errors.length ? errors : 'none');

const ok =
  camD.x > cam0.x + 1 && // panned right
  camW.y < cam0.y - 1 && // panned up
  (order === 'move' || order === 'attackMove') &&
  errors.length === 0;
await browser.close();
console.log(ok ? 'CONTROLS SMOKE OK' : 'CONTROLS SMOKE FAILED');
process.exit(ok ? 0 : 1);
