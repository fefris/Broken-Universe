// Headless smoke test: boots the game in Edge, starts a battle, verifies
// selection/orders/combat, captures screenshots. Run: node scripts/smoke.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const OUT = 'scripts/out';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error' && !msg.text().includes('404')) errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/01-menu.png` });

await page.fill('#opt-seed', '777');
await page.click('#btn-start');
await page.waitForTimeout(1500);

// Locate the player squad on screen via the debug handle.
const squadScreen = await page.evaluate(() => {
  const { runner, renderer } = window.__bu;
  const units = runner.world.commanders[0].squad
    .map((id) => runner.world.units[id])
    .filter((u) => u.alive);
  const pts = units.map((u) => renderer.camera.worldToScreen(u.pos));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    minX: Math.min(...xs) - 30,
    maxX: Math.max(...xs) + 30,
    minY: Math.min(...ys) - 30,
    maxY: Math.max(...ys) + 30,
  };
});

// Drag-select the whole squad.
await page.mouse.move(squadScreen.minX, squadScreen.minY);
await page.mouse.down();
await page.mouse.move(squadScreen.maxX, squadScreen.maxY, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(200);

const selectedCount = await page.evaluate(() => window.__bu.controls.selection.size);

// Order the squad toward The Crossing (PoC index 1).
await page.evaluate(() => {
  const { runner, controls } = window.__bu;
  runner.enqueue({
    type: 'attackMove',
    commanderId: 0,
    unitIds: [...controls.selection],
    goal: { ...runner.world.pocs[1].pos },
  });
});

const posBefore = await page.evaluate(() => {
  const u = window.__bu.runner.world.units[0];
  return { x: u.pos.x, y: u.pos.y };
});
await page.waitForTimeout(8000);
const posAfter = await page.evaluate(() => {
  const u = window.__bu.runner.world.units[0];
  return { x: u.pos.x, y: u.pos.y };
});
const moved = Math.hypot(posAfter.x - posBefore.x, posAfter.y - posBefore.y);

// Jump the camera to The Crossing to watch the fight develop.
await page.evaluate(() => {
  const { renderer, runner } = window.__bu;
  renderer.camera.centerOn(runner.world.pocs[1].pos);
});
await page.waitForTimeout(20000);
await page.screenshot({ path: `${OUT}/05-crossing-fight.png` });

// Let the lines collide properly, then look again.
await page.waitForTimeout(35000);
await page.evaluate(() => {
  const { renderer, runner } = window.__bu;
  renderer.camera.centerOn(runner.world.pocs[1].pos);
});
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/06-melee.png` });

const stats = await page.evaluate(() => {
  const w = window.__bu.runner.world;
  return {
    tick: w.tick,
    aliveAttackers: w.units.filter((u) => u.alive && u.team === 0).length,
    aliveDefenders: w.units.filter((u) => u.alive && u.team === 1).length,
    deaths: w.units.filter((u) => !u.alive).length,
    totalUnits: w.units.length,
    projectiles: w.projectiles.length,
    pocs: w.pocs.map((p) => ({
      label: p.label,
      owner: p.owner,
      pct: Math.round((p.progress / p.captureTicks) * 100),
    })),
    result: w.result,
  };
});

console.log('selected:', selectedCount, '/ 10');
console.log('unit 0 moved:', moved.toFixed(1), 'm');
console.log('world:', JSON.stringify(stats, null, 2));
console.log('console errors:', errors.length ? errors : 'none');

const ok = selectedCount === 10 && moved > 10 && errors.length === 0;
await browser.close();
console.log(ok ? 'SMOKE OK' : 'SMOKE FAILED');
process.exit(ok ? 0 : 1);
