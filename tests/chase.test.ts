import { describe, expect, it } from 'vitest';
import type { Command } from '../src/sim/commands';
import type { MapDef } from '../src/sim/map/maps';
import { TILE_BLOCKED, TILE_OPEN, Tilemap } from '../src/sim/map/tilemap';
import { ATTACKER, DEFENDER, dist } from '../src/sim/types';
import { createBattle, tick } from '../src/sim/world';
import { resolve } from './helpers';

/**
 * Map with a vertical wall (left of centre) that has a gap along the bottom,
 * so a squad on the left has no line of sight to a target on the right and
 * must route around to close.
 */
function wallMap(): MapDef {
  const cols = 44;
  const rows = 30;
  const tiles = new Uint8Array(cols * rows).fill(TILE_OPEN);
  const wallCol = 22; // x ~88-92m
  for (let ty = 0; ty < 19; ty++) tiles[ty * cols + wallCol] = TILE_BLOCKED; // gap below y~76m
  const map = new Tilemap(cols, rows, tiles);
  return {
    name: 'Wall Range',
    map,
    pocs: [{ label: 'X', pos: { x: 60, y: 60 }, radius: 10, captureSeconds: 60 }],
    spawnZones: [
      { team: ATTACKER, center: { x: 30, y: 30 }, radius: 12 },
      { team: DEFENDER, center: { x: 150, y: 30 }, radius: 12 },
    ],
  };
}

describe('chasing a target', () => {
  it('out-of-LOS units route around terrain and close instead of freezing', () => {
    const world = createBattle({
      seed: 1,
      mapDef: wallMap(),
      commanders: [
        {
          team: ATTACKER,
          name: 'A',
          squadDesignIds: ['d_mote', 'd_mote', 'd_mote', 'd_mote', 'd_mote', 'd_mote'],
          reserveDesignIds: [],
        },
        { team: DEFENDER, name: 'D', squadDesignIds: ['d_mote'], reserveDesignIds: [] },
      ],
      resolve,
    });

    const attackers = world.units.filter((u) => u.team === ATTACKER);
    const dummy = world.units.find((u) => u.team === DEFENDER)!;

    // Park the squad behind the wall, spread vertically; line them up at y<76m
    // so the wall sits directly between them and the target.
    attackers.forEach((u, i) => {
      const y = 16 + i * 8;
      u.pos = { x: 40, y };
      u.prevPos = { x: 40, y };
    });
    // A harmless, immovable target: no weapons (never acquires, never chases)
    // and effectively unkillable so every attacker gets a chance to fire.
    dummy.pos = { x: 130, y: 28 };
    dummy.prevPos = { x: 130, y: 28 };
    dummy.stats = { ...dummy.stats, weapons: [], maxHealth: 5_000_000 };
    dummy.hp = 5_000_000;

    // Confirm the premise: the wall really blocks line of sight.
    expect(world.map.los(attackers[0]!.pos, dummy.pos)).toBe(false);

    const startDist = new Map<number, number>(attackers.map((u) => [u.id, dist(u.pos, dummy.pos)]));

    const order: Command = {
      type: 'attackTarget',
      commanderId: 0,
      unitIds: attackers.map((u) => u.id),
      targetId: dummy.id,
    };
    tick(world, [order], resolve);
    for (let i = 0; i < 1600 && world.result === null; i++) tick(world, [], resolve);

    // Every attacker closed the distance substantially — none froze.
    for (const u of attackers) {
      const moved = startDist.get(u.id)! - dist(u.pos, dummy.pos);
      expect(moved, `unit ${u.id} should have advanced`).toBeGreaterThan(40);
    }

    // And more than just the nearest unit ended up engaging the target.
    const shooters = attackers.filter((u) => u.damageDealt > 0).length;
    expect(shooters).toBeGreaterThanOrEqual(3);
  });

  it('in-range units with a clear shot hold and fire', () => {
    const world = createBattle({
      seed: 2,
      mapDef: wallMap(),
      commanders: [
        { team: ATTACKER, name: 'A', squadDesignIds: ['d_mote', 'd_mote'], reserveDesignIds: [] },
        { team: DEFENDER, name: 'D', squadDesignIds: ['d_mote'], reserveDesignIds: [] },
      ],
      resolve,
    });
    const [a1, a2] = world.units.filter((u) => u.team === ATTACKER);
    const dummy = world.units.find((u) => u.team === DEFENDER)!;
    // Both attackers already within the Mote's 14m range, clear ground.
    a1!.pos = { x: 30, y: 100 };
    a1!.prevPos = { ...a1!.pos };
    a2!.pos = { x: 33, y: 100 };
    a2!.prevPos = { ...a2!.pos };
    dummy.pos = { x: 40, y: 100 };
    dummy.prevPos = { ...dummy.pos };
    dummy.stats = { ...dummy.stats, weapons: [], maxHealth: 5_000_000 };
    dummy.hp = 5_000_000;

    tick(
      world,
      [{ type: 'attackTarget', commanderId: 0, unitIds: [a1!.id, a2!.id], targetId: dummy.id }],
      resolve,
    );
    for (let i = 0; i < 120; i++) tick(world, [], resolve);

    // They stayed roughly put (held) and both dealt damage.
    expect(dist(a1!.pos, { x: 30, y: 100 })).toBeLessThan(8);
    expect(a1!.damageDealt).toBeGreaterThan(0);
    expect(a2!.damageDealt).toBeGreaterThan(0);
  });
});
