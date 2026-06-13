/**
 * Flat territory tessellation for the strategic war map. Given the province
 * centroids, build convex Voronoi cells (filled, border-sharing regions) by
 * clipping a boundary polygon against each perpendicular bisector — exact and
 * dependency-free. Pure geometry, UI-only (the sim never imports this).
 */

export interface Pt {
  x: number;
  y: number;
}

export interface Site extends Pt {
  id: string;
}

/** Clip a convex polygon to the half-plane of points at least as close to `site` as to `other`. */
function clipToBisector(poly: Pt[], site: Pt, other: Pt): Pt[] {
  const mx = (site.x + other.x) / 2;
  const my = (site.y + other.y) / 2;
  const nx = other.x - site.x; // normal points toward `other`
  const ny = other.y - site.y;
  // Signed distance from the bisector; <= 0 is the `site` side (kept).
  const sd = (p: Pt) => (p.x - mx) * nx + (p.y - my) * ny;
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const da = sd(a);
    const db = sd(b);
    if (da <= 0) out.push(a);
    if (da <= 0 !== db <= 0) {
      const t = da / (da - db);
      out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
    }
  }
  return out;
}

/** Voronoi cell polygon per site id, clipped to `boundary` (a convex CCW/CW polygon). */
export function voronoiCells(sites: Site[], boundary: Pt[]): Map<string, Pt[]> {
  const cells = new Map<string, Pt[]>();
  for (const s of sites) {
    let poly = boundary.slice();
    for (const o of sites) {
      if (o.id === s.id) continue;
      poly = clipToBisector(poly, s, o);
      if (poly.length === 0) break;
    }
    cells.set(s.id, poly);
  }
  return cells;
}

/** A rounded-rectangle boundary polygon (continent silhouette) in the given box. */
export function roundedRectBoundary(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  cornerSteps = 4,
): Pt[] {
  const pts: Pt[] = [];
  const corner = (cx: number, cy: number, startDeg: number) => {
    for (let i = 0; i <= cornerSteps; i++) {
      const a = ((startDeg + (i / cornerSteps) * 90) * Math.PI) / 180;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  };
  corner(x + w - r, y + h - r, 0); // bottom-right
  corner(x + r, y + h - r, 90); // bottom-left
  corner(x + r, y + r, 180); // top-left
  corner(x + w - r, y + r, 270); // top-right
  return pts;
}

/** Midpoint of two centroids — lies on the shared Voronoi edge of adjacent sites. */
export function borderMidpoint(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Serialize a polygon to an SVG `points` attribute. */
export function polygonPoints(poly: Pt[]): string {
  return poly.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}
