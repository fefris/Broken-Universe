import { SPATIAL_CELL_SIZE } from './constants';
import type { UnitState, Vec2 } from './types';

/**
 * Uniform grid hash over alive units, rebuilt from scratch every tick.
 * O(n) rebuild at ~300 units is microseconds and avoids incremental bugs.
 */
export class SpatialGrid {
  private cells = new Map<number, number[]>();
  private readonly cols: number;
  private readonly rows: number;

  constructor(
    private readonly width: number,
    private readonly height: number,
  ) {
    this.cols = Math.ceil(width / SPATIAL_CELL_SIZE);
    this.rows = Math.ceil(height / SPATIAL_CELL_SIZE);
  }

  private cellIndex(x: number, y: number): number {
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor(x / SPATIAL_CELL_SIZE)));
    const cy = Math.min(this.rows - 1, Math.max(0, Math.floor(y / SPATIAL_CELL_SIZE)));
    return cy * this.cols + cx;
  }

  rebuild(units: UnitState[]): void {
    this.cells.clear();
    for (const unit of units) {
      if (!unit.alive) continue;
      const idx = this.cellIndex(unit.pos.x, unit.pos.y);
      const bucket = this.cells.get(idx);
      if (bucket) bucket.push(unit.id);
      else this.cells.set(idx, [unit.id]);
    }
  }

  /** Unit ids whose cell intersects the circle; callers must distance-filter. */
  queryCircle(center: Vec2, radius: number, out: number[]): number[] {
    out.length = 0;
    const minCx = Math.max(0, Math.floor((center.x - radius) / SPATIAL_CELL_SIZE));
    const maxCx = Math.min(this.cols - 1, Math.floor((center.x + radius) / SPATIAL_CELL_SIZE));
    const minCy = Math.max(0, Math.floor((center.y - radius) / SPATIAL_CELL_SIZE));
    const maxCy = Math.min(this.rows - 1, Math.floor((center.y + radius) / SPATIAL_CELL_SIZE));
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this.cells.get(cy * this.cols + cx);
        if (bucket) {
          for (const id of bucket) out.push(id);
        }
      }
    }
    return out;
  }
}
