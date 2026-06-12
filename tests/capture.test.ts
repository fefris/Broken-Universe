import { describe, expect, it } from 'vitest';
import { secondsToTicks } from '../src/sim/constants';
import { captureRate } from '../src/sim/systems/capture';
import { ATTACKER, DEFENDER } from '../src/sim/types';
import { createBattle, tick } from '../src/sim/world';
import { openMapDef, resolve } from './helpers';

function pocBattle() {
  const mapDef = openMapDef();
  const world = createBattle({
    seed: 42,
    mapDef,
    commanders: [
      { team: ATTACKER, name: 'A', squadDesignIds: ['d_mote', 'd_mote'], reserveDesignIds: [] },
      { team: DEFENDER, name: 'D', squadDesignIds: ['d_mote'], reserveDesignIds: [] },
    ],
    resolve,
  });
  return { world, poc: world.pocs[0]! };
}

function teleport(world: ReturnType<typeof pocBattle>['world'], unitId: number, x: number, y: number) {
  const u = world.units[unitId]!;
  u.pos = { x, y };
  u.prevPos = { x, y };
}

describe('PoC capture', () => {
  it('scales capture rate with attacker count, capped at 3x', () => {
    expect(captureRate(0)).toBe(0);
    expect(captureRate(1)).toBe(1);
    expect(captureRate(2)).toBe(1.5);
    expect(captureRate(5)).toBe(3);
    expect(captureRate(20)).toBe(3);
  });

  it('accrues progress for lone attackers and flips ownership', () => {
    const { world, poc } = pocBattle();
    teleport(world, 0, poc.pos.x, poc.pos.y);
    // Park everyone else far away.
    teleport(world, 1, 10, 10);
    teleport(world, 2, 150, 110);
    const needed = secondsToTicks(10);
    for (let i = 0; i <= needed && poc.owner === DEFENDER; i++) {
      tick(world, [], resolve);
    }
    expect(poc.owner).toBe(ATTACKER);
  });

  it('freezes progress while contested', () => {
    const { world, poc } = pocBattle();
    teleport(world, 0, poc.pos.x - 8, poc.pos.y); // attacker in zone
    teleport(world, 1, 10, 10);
    teleport(world, 2, poc.pos.x + 8, poc.pos.y); // defender in zone too
    // The mote weapons have range 14 so they will fight; disarm them for the test.
    for (const u of world.units) {
      u.energy = 0;
      u.stats = { ...u.stats, energyRecharge: 0 };
    }
    for (let i = 0; i < 40; i++) tick(world, [], resolve);
    expect(poc.progress).toBe(0);
    expect(poc.owner).toBe(DEFENDER);
  });

  it('decays progress at double rate when attackers leave', () => {
    const { world, poc } = pocBattle();
    teleport(world, 0, poc.pos.x, poc.pos.y);
    teleport(world, 1, 10, 10);
    teleport(world, 2, 150, 110);
    for (let i = 0; i < 20; i++) tick(world, [], resolve);
    const gained = poc.progress;
    expect(gained).toBeGreaterThan(0);
    // Pull the attacker out; progress should decay at 2/tick.
    teleport(world, 0, 10, 30);
    const before = poc.progress;
    tick(world, [], resolve);
    expect(poc.progress).toBeLessThan(before);
    for (let i = 0; i < 30; i++) tick(world, [], resolve);
    expect(poc.progress).toBe(0);
  });
});
