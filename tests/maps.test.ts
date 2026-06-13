import { describe, expect, it } from 'vitest';
import { provinceDef } from '../src/meta/campaign';
import { PROVINCE_MAPS, mapForProvince } from '../src/sim/map/library';
import { resolveSpawnZones } from '../src/sim/map/maps';
import { TILE_BLOCKED } from '../src/sim/map/tilemap';
import { ATTACKER, DEFENDER } from '../src/sim/types';

describe('province battlefields', () => {
  for (const id of Object.keys(PROVINCE_MAPS)) {
    describe(id, () => {
      const def = mapForProvince(id);

      it('has one portal per neighbouring territory', () => {
        const neighbours = provinceDef(id).adj.length;
        expect(def.portals?.length).toBe(neighbours);
      });

      it('has portals with unique compass slots', () => {
        const slots = (def.portals ?? []).map((p) => p.id);
        expect(new Set(slots).size).toBe(slots.length);
      });

      it('has 3-5 PoCs, each in bounds and on open ground', () => {
        expect(def.pocs.length).toBeGreaterThanOrEqual(3);
        expect(def.pocs.length).toBeLessThanOrEqual(5);
        for (const poc of def.pocs) {
          expect(poc.pos.x).toBeGreaterThan(0);
          expect(poc.pos.y).toBeGreaterThan(0);
          expect(poc.pos.x).toBeLessThan(def.map.widthMeters);
          expect(poc.pos.y).toBeLessThan(def.map.heightMeters);
          expect(def.map.tileAtWorld(poc.pos)).not.toBe(TILE_BLOCKED);
        }
      });

      it('resolves to two opposed spawn zones', () => {
        const zones = resolveSpawnZones(def, 0);
        expect(zones.map((z) => z.team).sort()).toEqual([ATTACKER, DEFENDER]);
        // Attacker and defender zones must be distinct points.
        const [a, b] = zones;
        expect(a!.center.x !== b!.center.x || a!.center.y !== b!.center.y).toBe(true);
      });
    });
  }
});
