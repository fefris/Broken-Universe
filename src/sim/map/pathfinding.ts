import type { Vec2 } from '../types';
import { TILE_BLOCKED, TILE_SLOW, type Tilemap } from './tilemap';

/** Min-heap keyed on f-score, storing node indices. */
class Heap {
  private items: number[] = [];
  constructor(private readonly f: Float64Array) {}

  get size(): number {
    return this.items.length;
  }

  push(node: number): void {
    const items = this.items;
    items.push(node);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.f[items[parent]!]! <= this.f[items[i]!]!) break;
      [items[parent], items[i]] = [items[i]!, items[parent]!];
      i = parent;
    }
  }

  pop(): number {
    const items = this.items;
    const top = items[0]!;
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let best = i;
        if (l < items.length && this.f[items[l]!]! < this.f[items[best]!]!) best = l;
        if (r < items.length && this.f[items[r]!]! < this.f[items[best]!]!) best = r;
        if (best === i) break;
        [items[best], items[i]] = [items[i]!, items[best]!];
        i = best;
      }
    }
    return top;
  }
}

const SQRT2 = Math.SQRT2;

function octile(dx: number, dy: number): number {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  return ax > ay ? ax + (SQRT2 - 1) * ay : ay + (SQRT2 - 1) * ax;
}

/**
 * 8-directional A* over the tile grid. Diagonals never cut corners.
 * Slow tiles cost double. Returns world-space waypoints (smoothed via
 * line-of-sight string pulling), or null when no path exists.
 * Unreachable goals are retargeted to the nearest open tile.
 */
export function findPath(map: Tilemap, from: Vec2, to: Vec2): Vec2[] | null {
  const start = map.worldToTile(map.nearestOpen(from));
  const goalWorld = map.nearestOpen(to);
  const goal = map.worldToTile(goalWorld);
  if (start.tx === goal.tx && start.ty === goal.ty) return [goalWorld];

  const { cols, rows } = map;
  const n = cols * rows;
  const g = new Float64Array(n).fill(Number.POSITIVE_INFINITY);
  const f = new Float64Array(n).fill(Number.POSITIVE_INFINITY);
  const cameFrom = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);

  const startIdx = start.ty * cols + start.tx;
  const goalIdx = goal.ty * cols + goal.tx;
  g[startIdx] = 0;
  f[startIdx] = octile(goal.tx - start.tx, goal.ty - start.ty);

  const heap = new Heap(f);
  heap.push(startIdx);

  while (heap.size > 0) {
    const current = heap.pop();
    if (current === goalIdx) break;
    if (closed[current]) continue;
    closed[current] = 1;

    const cx = current % cols;
    const cy = (current / cols) | 0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const tile = map.tileAt(nx, ny);
        if (tile === TILE_BLOCKED) continue;
        // No corner cutting: a diagonal needs both orthogonal neighbors open.
        if (dx !== 0 && dy !== 0) {
          if (map.tileAt(cx + dx, cy) === TILE_BLOCKED) continue;
          if (map.tileAt(cx, cy + dy) === TILE_BLOCKED) continue;
        }
        const idx = ny * cols + nx;
        if (closed[idx]) continue;
        const stepCost = (dx !== 0 && dy !== 0 ? SQRT2 : 1) * (tile === TILE_SLOW ? 2 : 1);
        const tentative = g[current]! + stepCost;
        if (tentative < g[idx]!) {
          g[idx] = tentative;
          f[idx] = tentative + octile(goal.tx - nx, goal.ty - ny);
          cameFrom[idx] = current;
          heap.push(idx);
        }
      }
    }
  }

  if (cameFrom[goalIdx] === -1 && goalIdx !== startIdx) return null;

  // Reconstruct tile path, then string-pull with LOS checks.
  const tilePath: Vec2[] = [];
  let node = goalIdx;
  while (node !== -1) {
    tilePath.push(map.tileCenter(node % cols, (node / cols) | 0));
    node = cameFrom[node]!;
  }
  tilePath.reverse();
  tilePath[tilePath.length - 1] = goalWorld;

  const smoothed: Vec2[] = [];
  let anchor = from;
  let i = 0;
  while (i < tilePath.length - 1) {
    // Furthest waypoint visible from the anchor.
    let furthest = i;
    for (let j = tilePath.length - 1; j > i; j--) {
      if (map.los(anchor, tilePath[j]!)) {
        furthest = j;
        break;
      }
    }
    if (furthest === i) furthest = i + 1; // always make progress
    anchor = tilePath[furthest]!;
    smoothed.push(anchor);
    i = furthest;
  }
  if (smoothed.length === 0) smoothed.push(goalWorld);
  return smoothed;
}
