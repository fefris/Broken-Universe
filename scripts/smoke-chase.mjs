// Chase bug smoke test: select the whole player squad, order an attack on a
// distant enemy, and confirm the WHOLE group closes the distance (not just the
// nearest unit). Run with dev server up: node scripts/smoke-chase.mjs
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
// Skirmish as attacker.
await page.evaluate(() => {
  document.querySelector('#skirmish-panel').open = true;
});
await page.fill('#opt-seed', '555');
await page.click('#btn-start');
await page.waitForTimeout(1500);

// Select the whole squad and order an attack on the farthest enemy in sight.
const before = await page.evaluate(() => {
  const { runner, controls } = window.__bu;
  const w = runner.world;
  const mine = w.commanders[0].squad.map((id) => w.units[id]).filter((u) => u.alive);
  for (const u of mine) controls.selection.add(u.id);
  const enemies = w.units.filter((u) => u.alive && u.team !== 0);
  // Farthest enemy from the squad centroid (forces a real advance).
  const cx = mine.reduce((s, u) => s + u.pos.x, 0) / mine.length;
  const cy = mine.reduce((s, u) => s + u.pos.y, 0) / mine.length;
  const target = enemies
    .map((e) => ({ e, d: Math.hypot(e.pos.x - cx, e.pos.y - cy) }))
    .sort((a, b) => b.d - a.d)[0].e;
  runner.enqueue({
    type: 'attackTarget',
    commanderId: 0,
    unitIds: mine.map((u) => u.id),
    targetId: target.id,
  });
  return {
    targetId: target.id,
    dists: mine.map((u) => ({
      id: u.id,
      d: Math.hypot(u.pos.x - target.pos.x, u.pos.y - target.pos.y),
    })),
  };
});

await page.waitForTimeout(6000);

const after = await page.evaluate((targetId) => {
  const w = window.__bu.runner.world;
  const target = w.units[targetId];
  const ref = target.alive ? target.pos : w.pocs[1].pos;
  const mine = w.commanders[0].squad.map((id) => w.units[id]).filter((u) => u.alive);
  return mine.map((u) => ({ id: u.id, d: Math.hypot(u.pos.x - ref.x, u.pos.y - ref.y) }));
}, before.targetId);

const beforeById = new Map(before.dists.map((x) => [x.id, x.d]));
let advanced = 0;
let frozen = 0;
for (const a of after) {
  const b = beforeById.get(a.id);
  if (b === undefined) continue;
  if (b - a.d > 8) advanced++;
  else if (Math.abs(b - a.d) < 1.5) frozen++;
}

console.log(`units: ${after.length}, advanced: ${advanced}, frozen-ish: ${frozen}`);
console.log('console errors:', errors.length ? errors : 'none');

// Most of the group should have closed the distance; almost none should sit frozen.
const ok = advanced >= Math.ceil(after.length * 0.7) && frozen <= 1 && errors.length === 0;
await browser.close();
console.log(ok ? 'CHASE SMOKE OK' : 'CHASE SMOKE FAILED');
process.exit(ok ? 0 : 1);
