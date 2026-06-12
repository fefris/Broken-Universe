import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../src/sim/constants';
import { findPath } from '../src/sim/map/pathfinding';
import { TILE_BLOCKED, TILE_OPEN, TILE_SLOW, Tilemap } from '../src/sim/map/tilemap';

function mapFromAscii(rows: string[]): Tilemap {
  const h = rows.length;
  const w = rows[0]!.length;
  const tiles = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y]![x];
      tiles[y * w + x] = ch === '#' ? TILE_BLOCKED : ch === '~' ? TILE_SLOW : TILE_OPEN;
    }
  }
  return new Tilemap(w, h, tiles);
}

const at = (tx: number, ty: number) => ({ x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE });

describe('A* pathfinding', () => {
  it('routes around a wall', () => {
    const map = mapFromAscii([
      '..........',
      '....#.....',
      '....#.....',
      '....#.....',
      '..........',
    ]);
    const path = findPath(map, at(2, 2), at(7, 2));
    expect(path).not.toBeNull();
    // Path must not cross the wall column except via the open bottom row.
    const last = path![path!.length - 1]!;
    expect(last.x).toBeCloseTo(at(7, 2).x);
    expect(last.y).toBeCloseTo(at(7, 2).y);
    for (const wp of path!) {
      expect(map.isBlockedWorld(wp)).toBe(false);
    }
  });

  it('returns null when fully walled off', () => {
    const map = mapFromAscii([
      '....#.....',
      '....#.....',
      '....#.....',
      '....#.....',
      '....#.....',
    ]);
    expect(findPath(map, at(2, 2), at(7, 2))).toBeNull();
  });

  it('retargets goals inside walls to the nearest open tile', () => {
    const map = mapFromAscii(['..........', '....##....', '....##....', '..........']);
    const path = findPath(map, at(1, 1), at(4, 1));
    expect(path).not.toBeNull();
    const last = path![path!.length - 1]!;
    expect(map.isBlockedWorld(last)).toBe(false);
  });

  it('prefers open ground over slow terrain when it is cheap to go around', () => {
    const map = mapFromAscii(['..........', '~~~~~~~~..', '..........']);
    // Crossing the ash band costs double; the detour through column 8-9 is cheaper.
    const path = findPath(map, at(0, 0), at(0, 2));
    expect(path).not.toBeNull();
  });
});

describe('line of sight', () => {
  it('blocks LOS through walls and passes in the open', () => {
    const map = mapFromAscii(['..........', '....#.....', '..........']);
    expect(map.los(at(2, 1), at(7, 1))).toBe(false);
    expect(map.los(at(2, 0), at(7, 0))).toBe(true);
    expect(map.los(at(2, 2), at(7, 2))).toBe(true);
  });
});
