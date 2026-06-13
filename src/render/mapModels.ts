import type { Graphics } from 'pixi.js';
import { TILE_SIZE } from '../sim/constants';
import type { Portal } from '../sim/map/maps';
import { TILE_BLOCKED, TILE_OPEN, TILE_SLOW } from '../sim/map/tilemap';
import { type PoC, type SpawnZone, type World, otherTeam } from '../sim/types';
import {
  COLOR_BLOCKED,
  COLOR_OPEN,
  COLOR_SLOW,
  TEAM_COLORS,
  TILE_GRID,
  TILE_HIGHLIGHT,
  TILE_SHADOW,
} from './colors';

function tileNoise(tx: number, ty: number): number {
  let n = tx * 374_761_393 + ty * 668_265_263;
  n = (n ^ (n >> 13)) * 1_274_126_177;
  return (n ^ (n >> 16)) >>> 0;
}

function drawOpenTile(g: Graphics, tx: number, ty: number): void {
  const x = tx * TILE_SIZE;
  const y = ty * TILE_SIZE;
  const n = tileNoise(tx, ty);
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(COLOR_OPEN);
  if ((n & 3) === 0) {
    g.rect(x + 0.45, y + TILE_SIZE - 0.55, TILE_SIZE - 0.9, 0.12).fill({
      color: TILE_HIGHLIGHT,
      alpha: 0.18,
    });
  }
}

function drawSlowTile(g: Graphics, tx: number, ty: number): void {
  const x = tx * TILE_SIZE;
  const y = ty * TILE_SIZE;
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(COLOR_SLOW);
  g.poly([
    x,
    y + TILE_SIZE,
    x + TILE_SIZE,
    y,
    x + TILE_SIZE,
    y + 0.75,
    x + 0.75,
    y + TILE_SIZE,
  ]).fill({ color: 0x4f5e38, alpha: 0.3 });
  if ((tx + ty) % 2 === 0) {
    g.circle(x + TILE_SIZE * 0.5, y + TILE_SIZE * 0.5, 0.42).fill({
      color: 0x9cab72,
      alpha: 0.18,
    });
  }
}

function drawBlockedTile(g: Graphics, tx: number, ty: number): void {
  const x = tx * TILE_SIZE;
  const y = ty * TILE_SIZE;
  const n = tileNoise(tx, ty);
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(COLOR_BLOCKED);
  g.rect(x, y, TILE_SIZE, 0.45).fill({ color: TILE_HIGHLIGHT, alpha: 0.22 });
  g.rect(x, y + TILE_SIZE - 0.45, TILE_SIZE, 0.45).fill({ color: TILE_SHADOW, alpha: 0.35 });
  g.rect(x + TILE_SIZE - 0.45, y, 0.45, TILE_SIZE).fill({ color: TILE_SHADOW, alpha: 0.28 });
  if ((n & 7) < 3) {
    g.rect(x + 0.7, y + 0.8, TILE_SIZE - 1.4, 0.28).fill({ color: 0x657184, alpha: 0.3 });
  }
}

export function drawTerrainModel(g: Graphics, world: World): void {
  g.clear();
  g.rect(0, 0, world.map.widthMeters, world.map.heightMeters).fill(COLOR_OPEN);
  for (let ty = 0; ty < world.map.rows; ty++) {
    for (let tx = 0; tx < world.map.cols; tx++) {
      const tile = world.map.tileAt(tx, ty);
      if (tile === TILE_OPEN) drawOpenTile(g, tx, ty);
      else if (tile === TILE_SLOW) drawSlowTile(g, tx, ty);
      else if (tile === TILE_BLOCKED) drawBlockedTile(g, tx, ty);
      g.rect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE).stroke({
        width: 0.035,
        color: TILE_GRID,
        alpha: 0.28,
      });
    }
  }
}

/** A neutral deploy gate marker (the two active ones are overdrawn by spawn zones). */
export function drawPortalModel(g: Graphics, portal: Portal): void {
  const color = 0x9fb0c4;
  const { x, y } = portal.pos;
  g.circle(x, y, 5).stroke({ width: 0.4, color, alpha: 0.4 });
  g.circle(x, y, 2).fill({ color, alpha: 0.22 });
  // Two chevron ticks pointing inward (away from the map edge).
  const inward = portal.facing + Math.PI;
  for (const d of [-0.5, 0.5]) {
    const a = inward + d;
    g.moveTo(x + Math.cos(inward) * 2.5, y + Math.sin(inward) * 2.5)
      .lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6)
      .stroke({ width: 0.35, color, alpha: 0.35 });
  }
}

export function drawSpawnZoneModel(g: Graphics, zone: SpawnZone): void {
  const color = TEAM_COLORS[zone.team];
  g.circle(zone.center.x, zone.center.y, zone.radius).fill({ color, alpha: 0.045 });
  g.circle(zone.center.x, zone.center.y, zone.radius).stroke({ width: 0.5, color, alpha: 0.24 });
  g.circle(zone.center.x, zone.center.y, zone.radius * 0.55).stroke({
    width: 0.25,
    color,
    alpha: 0.18,
  });
}

export function drawPocModel(g: Graphics, poc: PoC): void {
  const color = TEAM_COLORS[poc.owner];
  g.circle(poc.pos.x, poc.pos.y, poc.radius).fill({ color, alpha: 0.08 });
  g.circle(poc.pos.x, poc.pos.y, poc.radius).stroke({ width: 0.45, color, alpha: 0.85 });
  g.circle(poc.pos.x, poc.pos.y, poc.radius * 0.45).stroke({ width: 0.2, color, alpha: 0.45 });

  const pad = Math.max(1.3, poc.radius * 0.18);
  const points: number[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    points.push(poc.pos.x + Math.cos(a) * pad, poc.pos.y + Math.sin(a) * pad);
  }
  g.poly(points).fill({ color, alpha: 0.9 });

  // Progress always counts toward whichever team does not own the point.
  if (poc.progress > 0) {
    const captureColor = TEAM_COLORS[otherTeam(poc.owner)];
    const frac = poc.progress / poc.captureTicks;
    const start = -Math.PI / 2;
    const r = poc.radius - 1;
    g.moveTo(poc.pos.x + Math.cos(start) * r, poc.pos.y + Math.sin(start) * r)
      .arc(poc.pos.x, poc.pos.y, r, start, start + frac * Math.PI * 2)
      .stroke({ width: 1, color: captureColor, alpha: 0.95 });
  }
}
