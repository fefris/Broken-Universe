import { loadContentDB } from '../src/content/db';
import { TILE_SIZE } from '../src/sim/constants';
import type { MapDef, PocDef } from '../src/sim/map/maps';
import { TILE_OPEN, Tilemap } from '../src/sim/map/tilemap';
import { ATTACKER, DEFENDER, type SpawnZone } from '../src/sim/types';

export const db = loadContentDB();

export const resolve = (designId: string) => db.resolved(designId);

/** Small fully-open map for focused system tests. */
export function openMapDef(
  cols = 40,
  rows = 30,
  pocs?: PocDef[],
  spawnZones?: SpawnZone[],
): MapDef {
  const tiles = new Uint8Array(cols * rows).fill(TILE_OPEN);
  const w = cols * TILE_SIZE;
  const h = rows * TILE_SIZE;
  return {
    name: 'Test Range',
    map: new Tilemap(cols, rows, tiles),
    pocs: pocs ?? [{ label: 'Alpha', pos: { x: w / 2, y: h / 2 }, radius: 10, captureSeconds: 10 }],
    spawnZones: spawnZones ?? [
      { team: ATTACKER, center: { x: 20, y: h / 2 }, radius: 12 },
      { team: DEFENDER, center: { x: w - 20, y: h / 2 }, radius: 12 },
    ],
  };
}
