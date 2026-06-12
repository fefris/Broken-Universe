import { describe, expect, it } from 'vitest';
import { BattleRunner } from '../src/game/runner';
import { buildBattleConfig } from '../src/game/setup';
import { serializeWorld } from '../src/sim/world';
import { db } from './helpers';

function runBattle(seed: number, ticks: number): { hashes: string[]; final: string } {
  const config = buildBattleConfig(
    { seed, attackerCommanders: 2, defenderCommanders: 2, playerTeam: null },
    db,
  );
  const runner = new BattleRunner(config, 'normal');
  const hashes: string[] = [];
  for (let i = 0; i < ticks; i++) {
    runner.step();
    if (i % 100 === 0) hashes.push(serializeWorld(runner.world));
    if (runner.world.result) break;
  }
  return { hashes, final: serializeWorld(runner.world) };
}

describe('determinism', () => {
  it('same seed + same AI = identical battle, snapshot for snapshot', () => {
    const a = runBattle(1234, 2000);
    const b = runBattle(1234, 2000);
    expect(a.hashes.length).toBe(b.hashes.length);
    for (let i = 0; i < a.hashes.length; i++) {
      expect(b.hashes[i], `snapshot at checkpoint ${i}`).toBe(a.hashes[i]);
    }
    expect(b.final).toBe(a.final);
  });

  it('different seeds diverge', () => {
    const a = runBattle(1, 500);
    const b = runBattle(2, 500);
    expect(a.final).not.toBe(b.final);
  });
});
