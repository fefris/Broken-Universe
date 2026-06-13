import { describe, expect, it } from 'vitest';
import { mapForProvince } from '../src/sim/map/library';
import { MapPainter, resolveSpawnZones } from '../src/sim/map/maps';
import { TILE_BLOCKED } from '../src/sim/map/tilemap';
import { ATTACKER, DEFENDER } from '../src/sim/types';

describe('resolveSpawnZones', () => {
  const crossroads = mapForProvince('crossroads'); // portals: nw, n, ne, sw, se

  it('puts the attacker at the portal facing the entry direction', () => {
    // -PI/2 is straight "north" (y-down) -> the 'n' gate.
    const zones = resolveSpawnZones(crossroads, -Math.PI / 2);
    const nGate = crossroads.portals?.find((p) => p.id === 'n')!;
    const attacker = zones.find((z) => z.team === ATTACKER)!;
    expect(attacker.center.x).toBeCloseTo(nGate.pos.x);
    expect(attacker.center.y).toBeCloseTo(nGate.pos.y);
  });

  it('places the defender at a different, roughly opposite gate', () => {
    const zones = resolveSpawnZones(crossroads, -Math.PI / 2);
    const attacker = zones.find((z) => z.team === ATTACKER)!;
    const defender = zones.find((z) => z.team === DEFENDER)!;
    expect(defender.center.y).toBeGreaterThan(attacker.center.y); // attacker north, defender south
  });

  it('is deterministic for the same inputs', () => {
    const a = resolveSpawnZones(crossroads, 0.3);
    const b = resolveSpawnZones(crossroads, 0.3);
    expect(a).toEqual(b);
  });

  it('different entry directions can select different attacker gates', () => {
    const north = resolveSpawnZones(crossroads, -Math.PI / 2).find((z) => z.team === ATTACKER)!;
    const southeast = resolveSpawnZones(crossroads, Math.PI / 4).find((z) => z.team === ATTACKER)!;
    expect(north.center.x !== southeast.center.x || north.center.y !== southeast.center.y).toBe(
      true,
    );
  });

  it('falls back to opposed centre zones when a map has no portals', () => {
    const p = new MapPainter(40, 30);
    p.border(TILE_BLOCKED);
    const def = p.build(
      'Bare',
      [{ label: 'A', pos: { x: 80, y: 60 }, radius: 8, captureSeconds: 10 }],
      [],
    );
    const zones = resolveSpawnZones(def, 0);
    expect(zones.map((z) => z.team).sort()).toEqual([ATTACKER, DEFENDER]);
    const [a, b] = zones;
    expect(a!.center.x).not.toBe(b!.center.x);
  });
});
