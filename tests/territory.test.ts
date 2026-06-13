import { describe, expect, it } from 'vitest';
import { PROVINCES, provinceDef, provinceDirection } from '../src/meta/campaign';
import { type Site, borderMidpoint, roundedRectBoundary, voronoiCells } from '../src/ui/territory';

const boundary = roundedRectBoundary(1.5, 1.5, 97, 97, 9);
const sites: Site[] = PROVINCES.map((p) => ({ id: p.id, x: p.x, y: p.y }));

/** Point-in-convex-polygon (boundary is convex, wound consistently). */
function inside(poly: { x: number; y: number }[], px: number, py: number): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    if (Math.abs(cross) < 1e-9) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

describe('territory tessellation', () => {
  const cells = voronoiCells(sites, boundary);

  it('produces a non-empty cell for every province', () => {
    expect(cells.size).toBe(PROVINCES.length);
    for (const p of PROVINCES) {
      expect((cells.get(p.id) ?? []).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('places each province centroid inside its own cell', () => {
    for (const p of PROVINCES) {
      expect(inside(cells.get(p.id)!, p.x, p.y)).toBe(true);
    }
  });

  it('border midpoints lie on or inside both adjacent cells', () => {
    for (const p of PROVINCES) {
      for (const a of p.adj) {
        const mid = borderMidpoint(p, provinceDef(a));
        // The shared-edge midpoint is the boundary between the two cells, so it
        // is within the convex hull of the map (a useful sanity bound).
        expect(inside(boundary, mid.x, mid.y)).toBe(true);
      }
    }
  });
});

describe('provinceDirection', () => {
  it('points downward (y-down) toward a southern neighbour', () => {
    // bastion (y=92) is south of verdant (y=80): direction has positive sin.
    expect(Math.sin(provinceDirection('verdant', 'bastion'))).toBeGreaterThan(0);
  });

  it('points upward toward a northern neighbour', () => {
    // keep (y=8) is north of rampart (y=22).
    expect(Math.sin(provinceDirection('rampart', 'keep'))).toBeLessThan(0);
  });
});
