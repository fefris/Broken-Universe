import { describe, expect, it } from 'vitest';
import { ATTACKER, DEFENDER } from '../src/sim/types';
import { createBattle, tick } from '../src/sim/world';
import { openMapDef, resolve } from './helpers';

function place(world: ReturnType<typeof createBattle>, unitId: number, x: number, y: number): void {
  const u = world.units[unitId]!;
  u.pos = { x, y };
  u.prevPos = { x, y };
}

/**
 * Two PoCs so capturing one never ends the battle — that lets us watch a point
 * flip to the attacker and then back to the defender (recapture). The second
 * PoC stays defender-owned and untouched, well away from our test units.
 */
function twoPocMap() {
  return openMapDef(40, 30, [
    { label: 'Alpha', pos: { x: 40, y: 60 }, radius: 10, captureSeconds: 10 },
    { label: 'Beta', pos: { x: 130, y: 60 }, radius: 10, captureSeconds: 10 },
  ]);
}

describe('PoC recapture (bidirectional)', () => {
  it('a defender can retake a point the attacker captured', () => {
    const world = createBattle({
      seed: 7,
      mapDef: twoPocMap(),
      commanders: [
        { team: ATTACKER, name: 'A', squadDesignIds: ['d_mote'], reserveDesignIds: [] },
        { team: DEFENDER, name: 'D', squadDesignIds: ['d_mote'], reserveDesignIds: [] },
      ],
      resolve,
    });
    const poc = world.pocs[0]!;
    const attacker = world.units.find((u) => u.team === ATTACKER)!;
    const defender = world.units.find((u) => u.team === DEFENDER)!;
    expect(poc.owner).toBe(DEFENDER); // PoCs start defender-owned

    // Phase 1: attacker holds the zone alone (defender parked out of sight) → flips to attacker.
    place(world, attacker.id, poc.pos.x, poc.pos.y);
    place(world, defender.id, 8, 8);
    for (let i = 0; i < 400 && poc.owner === DEFENDER; i++) tick(world, [], resolve);
    expect(poc.owner).toBe(ATTACKER);
    expect(world.result).toBeNull(); // still two PoCs in play

    // Phase 2: the defender retakes it (attacker pulled away) → flips back.
    place(world, attacker.id, 8, 8);
    place(world, defender.id, poc.pos.x, poc.pos.y);
    for (let i = 0; i < 400 && poc.owner === ATTACKER; i++) tick(world, [], resolve);
    expect(poc.owner).toBe(DEFENDER);
    expect(poc.progress).toBe(0);
  });

  it('contested points stay frozen for either owner', () => {
    const world = createBattle({
      seed: 8,
      mapDef: twoPocMap(),
      commanders: [
        { team: ATTACKER, name: 'A', squadDesignIds: ['d_mote'], reserveDesignIds: [] },
        { team: DEFENDER, name: 'D', squadDesignIds: ['d_mote'], reserveDesignIds: [] },
      ],
      resolve,
    });
    const poc = world.pocs[0]!;
    const attacker = world.units.find((u) => u.team === ATTACKER)!;
    const defender = world.units.find((u) => u.team === DEFENDER)!;
    // Both inside the zone; disarm so they don't kill each other.
    for (const u of world.units) {
      u.energy = 0;
      u.stats = { ...u.stats, energyRecharge: 0 };
    }
    place(world, attacker.id, poc.pos.x - 6, poc.pos.y);
    place(world, defender.id, poc.pos.x + 6, poc.pos.y);
    for (let i = 0; i < 60; i++) tick(world, [], resolve);
    expect(poc.owner).toBe(DEFENDER);
    expect(poc.progress).toBe(0);
  });
});
