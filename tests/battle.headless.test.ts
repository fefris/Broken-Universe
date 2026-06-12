import { describe, expect, it } from 'vitest';
import { BattleRunner } from '../src/game/runner';
import { buildBattleConfig } from '../src/game/setup';
import { ATTACKER, DEFENDER } from '../src/sim/types';
import { db } from './helpers';

/**
 * The milestone keystone test: full AI-vs-AI battles must terminate with a
 * winner, stay numerically sane, and have real fighting in them.
 */
describe('headless AI-vs-AI battle', () => {
  for (const seed of [11, 22, 33]) {
    it(`seed ${seed}: battle resolves cleanly`, { timeout: 60_000 }, () => {
      const config = buildBattleConfig(
        { seed, attackerCommanders: 3, defenderCommanders: 3, playerTeam: null },
        db,
      );
      const runner = new BattleRunner(config, 'normal');
      const world = runner.world;
      let deaths = 0;
      const damagedTeams = new Set<number>();

      const start = performance.now();
      while (!world.result && world.tick < world.durationTicks + 10) {
        const events = runner.step();
        for (const e of events) {
          if (e.type === 'unitDied') deaths++;
          if (e.type === 'unitDamaged') {
            const u = world.units[e.unitId];
            if (u) damagedTeams.add(u.team);
          }
        }
        if (world.tick % 500 === 0) {
          for (const u of world.units) {
            expect(Number.isFinite(u.pos.x), `unit ${u.id} x at tick ${world.tick}`).toBe(true);
            expect(Number.isFinite(u.pos.y), `unit ${u.id} y at tick ${world.tick}`).toBe(true);
            expect(Number.isFinite(u.hp), `unit ${u.id} hp at tick ${world.tick}`).toBe(true);
          }
        }
      }
      const elapsed = performance.now() - start;

      expect(world.result).not.toBeNull();
      expect([ATTACKER, DEFENDER]).toContain(world.result!.winner);
      // Real fighting happened: both teams took damage and units died.
      expect(damagedTeams.has(ATTACKER)).toBe(true);
      expect(damagedTeams.has(DEFENDER)).toBe(true);
      expect(deaths).toBeGreaterThan(5);
      // Perf canary: a full 15-minute battle should simulate well under 30s.
      expect(elapsed).toBeLessThan(30_000);
    });
  }
});
