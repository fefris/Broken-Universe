import { TILE_SIZE } from '../constants';
import { ATTACKER, DEFENDER, type SpawnZone, type Team, type Vec2 } from '../types';
import { TILE_BLOCKED, TILE_OPEN, TILE_SLOW, Tilemap } from './tilemap';

export interface PocDef {
  label: string;
  pos: Vec2;
  radius: number;
  captureSeconds: number;
}

export interface MapDef {
  name: string;
  map: Tilemap;
  pocs: PocDef[];
  spawnZones: SpawnZone[];
}

class MapPainter {
  readonly tiles: Uint8Array;

  constructor(
    readonly cols: number,
    readonly rows: number,
  ) {
    this.tiles = new Uint8Array(cols * rows).fill(TILE_OPEN);
  }

  /** Paint a rect given in METERS. */
  rect(x0: number, y0: number, x1: number, y1: number, value: number): void {
    const tx0 = Math.max(0, Math.floor(x0 / TILE_SIZE));
    const ty0 = Math.max(0, Math.floor(y0 / TILE_SIZE));
    const tx1 = Math.min(this.cols - 1, Math.floor((x1 - 0.01) / TILE_SIZE));
    const ty1 = Math.min(this.rows - 1, Math.floor((y1 - 0.01) / TILE_SIZE));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        this.tiles[ty * this.cols + tx] = value;
      }
    }
  }

  border(value: number): void {
    this.rect(0, 0, this.cols * TILE_SIZE, TILE_SIZE, value);
    this.rect(0, (this.rows - 1) * TILE_SIZE, this.cols * TILE_SIZE, this.rows * TILE_SIZE, value);
    this.rect(0, 0, TILE_SIZE, this.rows * TILE_SIZE, value);
    this.rect((this.cols - 1) * TILE_SIZE, 0, this.cols * TILE_SIZE, this.rows * TILE_SIZE, value);
  }
}

/**
 * Ashfall Crossing: 512x384 m. Attackers spawn west, defenders east.
 * Two broken ridge lines create three lanes; four PoCs, the Gatehouse
 * deep in defender territory.
 */
export function buildAshfallCrossing(): MapDef {
  const p = new MapPainter(128, 96);
  p.border(TILE_BLOCKED);

  // Western ridge (x 208..216) with three gaps.
  p.rect(208, 4, 216, 56, TILE_BLOCKED);
  p.rect(208, 104, 216, 168, TILE_BLOCKED);
  p.rect(208, 216, 216, 276, TILE_BLOCKED);
  p.rect(208, 324, 216, 380, TILE_BLOCKED);

  // Eastern ridge (x 300..308) with gaps offset from the western ones.
  p.rect(300, 4, 308, 36, TILE_BLOCKED);
  p.rect(300, 92, 308, 148, TILE_BLOCKED);
  p.rect(300, 232, 308, 288, TILE_BLOCKED);
  p.rect(300, 344, 308, 380, TILE_BLOCKED);

  // Central rock clusters near the Crossing.
  p.rect(244, 140, 268, 152, TILE_BLOCKED);
  p.rect(244, 232, 268, 244, TILE_BLOCKED);

  // Ash fields (slow) blanketing the approaches to the Crossing.
  p.rect(220, 160, 244, 224, TILE_SLOW);
  p.rect(268, 160, 296, 224, TILE_SLOW);

  // Soft cover pockets in the north and south lanes.
  p.rect(240, 56, 272, 76, TILE_SLOW);
  p.rect(240, 308, 272, 328, TILE_SLOW);

  return {
    name: 'Ashfall Crossing',
    map: new Tilemap(p.cols, p.rows, p.tiles),
    pocs: [
      { label: 'North Ridge', pos: { x: 256, y: 80 }, radius: 12, captureSeconds: 60 },
      { label: 'The Crossing', pos: { x: 256, y: 192 }, radius: 14, captureSeconds: 75 },
      { label: 'South Flats', pos: { x: 256, y: 304 }, radius: 12, captureSeconds: 60 },
      { label: 'Gatehouse', pos: { x: 400, y: 192 }, radius: 12, captureSeconds: 90 },
    ],
    spawnZones: [
      { team: ATTACKER, center: { x: 44, y: 192 }, radius: 28 },
      { team: DEFENDER, center: { x: 478, y: 192 }, radius: 28 },
    ],
  };
}

export function spawnZoneFor(zones: SpawnZone[], team: Team): SpawnZone {
  const zone = zones.find((z) => z.team === team);
  if (!zone) throw new Error(`no spawn zone for team ${team}`);
  return zone;
}
