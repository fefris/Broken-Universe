import { describe, it } from 'vitest';
import { BattleRunner } from '../src/game/runner';
import { buildBattleConfig } from '../src/game/setup';
import { ATTACKER } from '../src/sim/types';
import { db } from './helpers';

/** Battle timeline probe. Run: $env:DIAG='1'; npx vitest run tests/diag.test.ts */
describe.skipIf(!process.env.DIAG)('diagnostic timeline', () => {
  it('logs the flow of one battle', () => {
    const config = buildBattleConfig(
      { seed: 1, attackerCommanders: 3, defenderCommanders: 3, playerTeam: null },
      db,
    );
    const runner = new BattleRunner(config, 'normal');
    const w = runner.world;
    const rows: Record<string, unknown>[] = [];
    while (!w.result && w.tick <= w.durationTicks) {
      runner.step();
      if (w.tick % 1200 === 0 || w.result) {
        const aliveA = w.units.filter((u) => u.alive && u.team === ATTACKER);
        const aliveD = w.units.filter((u) => u.alive && u.team !== ATTACKER);
        rows.push({
          min: Math.round((w.tick / 20 / 60) * 10) / 10,
          atk: aliveA.length,
          def: aliveD.length,
          atkRes: w.commanders
            .filter((c) => c.team === ATTACKER)
            .reduce((s, c) => s + c.reserves.length, 0),
          defRes: w.commanders
            .filter((c) => c.team !== ATTACKER)
            .reduce((s, c) => s + c.reserves.length, 0),
          pocs: w.pocs.map((p) => (p.owner === ATTACKER ? 'A' : 'D')).join(''),
          intents: w.commanders
            .map(
              (c) =>
                `${c.team === ATTACKER ? 'a' : 'd'}:${c.intent?.kind?.slice(0, 3) ?? '-'}${c.intent?.pocId ?? ''}`,
            )
            .join(' '),
        });
      }
    }
    console.table(rows);
    console.log('result', w.result);
  });
});
