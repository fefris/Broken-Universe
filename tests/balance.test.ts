import { describe, expect, it } from 'vitest';
import { BattleRunner } from '../src/game/runner';
import { buildBattleConfig } from '../src/game/setup';
import { ticksToSeconds } from '../src/sim/constants';
import { ATTACKER } from '../src/sim/types';
import { db } from './helpers';

/**
 * Balance report across many seeds. Slow, so it only runs when asked:
 *   PowerShell: $env:BALANCE='1'; npm test -- tests/balance.test.ts
 */
describe.skipIf(!process.env.BALANCE)('balance report', () => {
  it('both sides win sometimes across seeds', { timeout: 180_000 }, () => {
    const results: { seed: number; winner: string; reason: string; minutes: number }[] = [];
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const config = buildBattleConfig(
        { seed, attackerCommanders: 3, defenderCommanders: 3, playerTeam: null },
        db,
      );
      const runner = new BattleRunner(config, 'normal');
      while (!runner.world.result && runner.world.tick <= runner.world.durationTicks + 10) {
        runner.step();
      }
      const r = runner.world.result!;
      results.push({
        seed,
        winner: r.winner === ATTACKER ? 'attacker' : 'defender',
        reason: r.reason,
        minutes: Math.round((ticksToSeconds(r.endTick) / 60) * 10) / 10,
      });
    }
    console.table(results);
    const attackerWins = results.filter((r) => r.winner === 'attacker').length;
    console.log(`attacker wins ${attackerWins}/8`);
    expect(attackerWins).toBeGreaterThan(0);
    expect(attackerWins).toBeLessThan(8);
  });
});
