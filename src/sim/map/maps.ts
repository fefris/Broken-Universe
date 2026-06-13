import { TILE_SIZE } from '../constants';
import { ATTACKER, DEFENDER, type SpawnZone, type Team, type Vec2 } from '../types';
import { TILE_BLOCKED, TILE_OPEN, TILE_SLOW, Tilemap } from './tilemap';

export interface PocDef {
  label: string;
  pos: Vec2;
  radius: number;
  captureSeconds: number;
}

/** Compass position of a deploy gate on the battlefield edge. */
export type PortalSlot = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

/**
 * A deploy gate where a team can enter the battlefield. Maps carry one portal
 * per neighbouring territory; a battle activates two of them (attacker entry +
 * defender hold) via {@link resolveSpawnZones}.
 */
export interface Portal {
  id: PortalSlot;
  pos: Vec2;
  /** Outward direction (radians, y-down) pointing toward the neighbour. */
  facing: number;
}

export interface MapDef {
  name: string;
  map: Tilemap;
  pocs: PocDef[];
  /** Candidate deploy gates around the edges (one per neighbouring territory). */
  portals?: Portal[];
  spawnZones: SpawnZone[];
}

/** Default deploy-zone radius (matches the original Ashfall spawns). */
export const SPAWN_RADIUS = 28;

/** Edge anchor + outward facing for each compass slot, given map extents. */
function portalAnchor(slot: PortalSlot, w: number, h: number, inset: number): Portal {
  const cx = w / 2;
  const cy = h / 2;
  const left = inset;
  const right = w - inset;
  const top = inset;
  const bottom = h - inset;
  const Q = Math.PI / 4;
  const table: Record<PortalSlot, [number, number, number]> = {
    n: [cx, top, -2 * Q],
    ne: [right, top, -Q],
    e: [right, cy, 0],
    se: [right, bottom, Q],
    s: [cx, bottom, 2 * Q],
    sw: [left, bottom, 3 * Q],
    w: [left, cy, 4 * Q],
    nw: [left, top, -3 * Q],
  };
  const [x, y, facing] = table[slot];
  return { id: slot, pos: { x, y }, facing };
}

export class MapPainter {
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

  get widthMeters(): number {
    return this.cols * TILE_SIZE;
  }

  get heightMeters(): number {
    return this.rows * TILE_SIZE;
  }

  /** Deploy gates at the given compass slots, inset from the edges. */
  portals(slots: PortalSlot[], inset = 44): Portal[] {
    return slots.map((slot) => portalAnchor(slot, this.widthMeters, this.heightMeters, inset));
  }

  build(name: string, pocs: PocDef[], portals: Portal[]): MapDef {
    const map = new Tilemap(this.cols, this.rows, this.tiles);
    const def: MapDef = { name, map, pocs, portals, spawnZones: [] };
    def.spawnZones = resolveSpawnZones(def);
    return def;
  }
}

/** Smallest absolute angle between two directions (radians, 0..π). */
function angleBetween(a: number, b: number): number {
  const tau = Math.PI * 2;
  let d = Math.abs(a - b) % tau;
  if (d > Math.PI) d = tau - d;
  return d;
}

/**
 * Choose the attacker + defender deploy zones for a battle. The attacker enters
 * through the portal whose facing is nearest `attackerFacing` (the compass
 * direction of the territory they are invading from); the defender holds the
 * portal furthest around the edge from it. Falls back to opposed centre points
 * when a map carries fewer than two portals (test ranges, legacy maps).
 */
export function resolveSpawnZones(mapDef: MapDef, attackerFacing = Math.PI): SpawnZone[] {
  const portals = mapDef.portals ?? [];
  const radius = SPAWN_RADIUS;
  if (portals.length < 2) {
    if (mapDef.spawnZones.length >= 2) return mapDef.spawnZones;
    const w = mapDef.map.widthMeters;
    const h = mapDef.map.heightMeters;
    return [
      { team: ATTACKER, center: { x: w * 0.1, y: h / 2 }, radius },
      { team: DEFENDER, center: { x: w * 0.9, y: h / 2 }, radius },
    ];
  }
  let attacker = portals[0]!;
  let bestAtk = Number.POSITIVE_INFINITY;
  for (const p of portals) {
    const d = angleBetween(p.facing, attackerFacing);
    if (d < bestAtk) {
      bestAtk = d;
      attacker = p;
    }
  }
  let defender = portals[0]!;
  let bestDef = -1;
  for (const p of portals) {
    if (p === attacker) continue;
    const d = angleBetween(p.facing, attacker.facing);
    if (d > bestDef) {
      bestDef = d;
      defender = p;
    }
  }
  return [
    { team: ATTACKER, center: { ...attacker.pos }, radius },
    { team: DEFENDER, center: { ...defender.pos }, radius },
  ];
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

  // Calderis Crossroads sits at the centre of the war map: five neighbours, five gates.
  return p.build(
    'Ashfall Crossing',
    [
      { label: 'North Ridge', pos: { x: 256, y: 80 }, radius: 12, captureSeconds: 60 },
      { label: 'The Crossing', pos: { x: 256, y: 192 }, radius: 14, captureSeconds: 75 },
      { label: 'South Flats', pos: { x: 256, y: 304 }, radius: 12, captureSeconds: 60 },
      { label: 'Gatehouse', pos: { x: 400, y: 192 }, radius: 12, captureSeconds: 90 },
    ],
    p.portals(['nw', 'n', 'ne', 'sw', 'se']),
  );
}

export function spawnZoneFor(zones: SpawnZone[], team: Team): SpawnZone {
  const zone = zones.find((z) => z.team === team);
  if (!zone) throw new Error(`no spawn zone for team ${team}`);
  return zone;
}
