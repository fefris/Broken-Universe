import { TILE_SIZE } from '../constants';
import type { Vec2 } from '../types';

export const TILE_OPEN = 0;
export const TILE_BLOCKED = 1;
export const TILE_SLOW = 2;

/** Speed multiplier on slow terrain (A* cost is the inverse). */
export const SLOW_SPEED_MULT = 0.5;

export class Tilemap {
  readonly widthMeters: number;
  readonly heightMeters: number;

  constructor(
    readonly cols: number,
    readonly rows: number,
    readonly tiles: Uint8Array,
  ) {
    if (tiles.length !== cols * rows) throw new Error('tile array size mismatch');
    this.widthMeters = cols * TILE_SIZE;
    this.heightMeters = rows * TILE_SIZE;
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.cols && ty < this.rows;
  }

  tileAt(tx: number, ty: number): number {
    if (!this.inBounds(tx, ty)) return TILE_BLOCKED;
    return this.tiles[ty * this.cols + tx] ?? TILE_BLOCKED;
  }

  tileAtWorld(pos: Vec2): number {
    return this.tileAt(Math.floor(pos.x / TILE_SIZE), Math.floor(pos.y / TILE_SIZE));
  }

  isBlockedWorld(pos: Vec2): boolean {
    return this.tileAtWorld(pos) === TILE_BLOCKED;
  }

  speedMultAt(pos: Vec2): number {
    return this.tileAtWorld(pos) === TILE_SLOW ? SLOW_SPEED_MULT : 1;
  }

  tileCenter(tx: number, ty: number): Vec2 {
    return { x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE };
  }

  worldToTile(pos: Vec2): { tx: number; ty: number } {
    return { tx: Math.floor(pos.x / TILE_SIZE), ty: Math.floor(pos.y / TILE_SIZE) };
  }

  /**
   * Grid line-of-sight between two world points (supercover walk).
   * Blocked tiles break LOS; slow tiles don't.
   */
  los(a: Vec2, b: Vec2): boolean {
    let { tx: x0, ty: y0 } = this.worldToTile(a);
    const { tx: x1, ty: y1 } = this.worldToTile(b);
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      if (this.tileAt(x0, y0) === TILE_BLOCKED) return false;
      if (x0 === x1 && y0 === y1) return true;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      } else if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
      // When stepping exactly through a corner, check both adjacent tiles.
      if (e2 > -dy && e2 < dx) {
        if (
          this.tileAt(x0, y0 - sy) === TILE_BLOCKED &&
          this.tileAt(x0 - sx, y0) === TILE_BLOCKED
        ) {
          return false;
        }
      }
    }
  }

  /** Nearest open tile center to a world point (spiral search). */
  nearestOpen(pos: Vec2): Vec2 {
    const { tx, ty } = this.worldToTile(pos);
    if (this.tileAt(tx, ty) !== TILE_BLOCKED) return pos;
    for (let r = 1; r < Math.max(this.cols, this.rows); r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.tileAt(tx + dx, ty + dy) !== TILE_BLOCKED) {
            return this.tileCenter(tx + dx, ty + dy);
          }
        }
      }
    }
    return pos;
  }
}
