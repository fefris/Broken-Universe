import { Container, Graphics } from 'pixi.js';
import type { ResolvedUnit } from '../content/schema';

export interface UnitModel {
  root: Container;
  teamParts: Graphics[];
  accentParts: Graphics[];
  rotates: boolean;
}

function part(color: number, alpha = 1): Graphics {
  const g = new Graphics();
  g.alpha = alpha;
  g.tint = color;
  return g;
}

function poly(points: number[], color: number, alpha = 1): Graphics {
  return part(color, alpha).poly(points).fill(0xffffff);
}

function rect(x: number, y: number, w: number, h: number, r: number, color: number, alpha = 1): Graphics {
  return part(color, alpha).roundRect(x, y, w, h, r).fill(0xffffff);
}

function circle(x: number, y: number, radius: number, color: number, alpha = 1): Graphics {
  return part(color, alpha).circle(x, y, radius).fill(0xffffff);
}

function strokePoly(points: number[], width: number, color: number, alpha = 1): Graphics {
  return part(color, alpha).poly(points).stroke({ width, color: 0xffffff });
}

function add(root: Container, children: Graphics[]): Graphics[] {
  for (const child of children) root.addChild(child);
  return children;
}

function infantryModel(unit: ResolvedUnit): UnitModel {
  const root = new Container();
  const teamParts: Graphics[] = [];
  const accentParts: Graphics[] = [];

  root.addChild(circle(0, 0.22, 0.82, 0x161b22, 0.8));
  if (unit.designId === 'd_courier') {
    root.addChild(poly([0.72, 0, -0.26, 0.56, -0.74, 0.22, -0.74, -0.22, -0.26, -0.56], 0x2f3947));
    teamParts.push(...add(root, [rect(-0.34, -0.3, 0.74, 0.6, 0.16, 0xffffff)]));
    accentParts.push(...add(root, [rect(0.24, -0.16, 0.54, 0.32, 0.08, 0x8fe3ff)]));
  } else if (unit.designId === 'd_bulwark') {
    root.addChild(rect(-0.72, -0.6, 1.1, 1.2, 0.24, 0x303947));
    teamParts.push(...add(root, [rect(-0.46, -0.42, 0.92, 0.84, 0.14, 0xffffff)]));
    root.addChild(rect(0.22, -0.1, 0.72, 0.2, 0.06, 0x202833));
  } else if (unit.designId === 'd_stinger') {
    root.addChild(poly([0.72, 0, -0.42, 0.62, -0.68, 0, -0.42, -0.62], 0x303947));
    teamParts.push(...add(root, [poly([0.4, 0, -0.26, 0.36, -0.42, 0, -0.26, -0.36], 0xffffff)]));
    accentParts.push(...add(root, [rect(0.06, -0.54, 0.62, 0.16, 0.05, 0xffd166), rect(0.06, 0.38, 0.62, 0.16, 0.05, 0xffd166)]));
  } else if (unit.designId === 'd_mender') {
    root.addChild(rect(-0.54, -0.54, 1.08, 1.08, 0.28, 0x2b3442));
    teamParts.push(...add(root, [circle(0, 0, 0.48, 0xffffff)]));
    accentParts.push(...add(root, [rect(-0.1, -0.56, 0.2, 1.12, 0.04, 0x7cf5c7), rect(-0.56, -0.1, 1.12, 0.2, 0.04, 0x7cf5c7)]));
  } else {
    root.addChild(rect(-0.56, -0.46, 1.02, 0.92, 0.22, 0x303947));
    teamParts.push(...add(root, [circle(-0.08, 0, 0.5, 0xffffff)]));
    root.addChild(rect(0.22, -0.08, 0.58, 0.16, 0.04, 0x202833));
  }

  return { root, teamParts, accentParts, rotates: true };
}

function mechanizedModel(unit: ResolvedUnit): UnitModel {
  const root = new Container();
  const teamParts: Graphics[] = [];
  const accentParts: Graphics[] = [];

  root.addChild(circle(0, 0.28, 1.0, 0x0d1117, 0.55));
  if (unit.designId === 'd_dustdevil') {
    root.addChild(poly([0.96, 0, 0.34, 0.58, -0.76, 0.46, -0.96, 0, -0.76, -0.46, 0.34, -0.58], 0x2d3945));
    teamParts.push(...add(root, [poly([0.62, 0, 0.12, 0.32, -0.44, 0.26, -0.56, 0, -0.44, -0.26, 0.12, -0.32], 0xffffff)]));
    accentParts.push(...add(root, [circle(-0.52, -0.42, 0.12, 0x7df9ff), circle(-0.52, 0.42, 0.12, 0x7df9ff)]));
  } else if (unit.designId === 'd_mastodon') {
    root.addChild(rect(-0.96, -0.72, 1.7, 1.44, 0.22, 0x333b46));
    root.addChild(rect(-1.06, -0.76, 0.3, 1.52, 0.09, 0x171d25));
    root.addChild(rect(0.66, -0.76, 0.3, 1.52, 0.09, 0x171d25));
    teamParts.push(...add(root, [rect(-0.54, -0.48, 0.92, 0.96, 0.14, 0xffffff)]));
    root.addChild(rect(0.2, -0.12, 0.94, 0.24, 0.05, 0x202833));
  } else if (unit.designId === 'd_longarm') {
    root.addChild(rect(-0.82, -0.52, 1.22, 1.04, 0.18, 0x303945));
    teamParts.push(...add(root, [rect(-0.52, -0.32, 0.72, 0.64, 0.12, 0xffffff)]));
    root.addChild(rect(0.0, -0.1, 1.18, 0.2, 0.04, 0x202833));
    accentParts.push(...add(root, [circle(0.78, 0, 0.16, 0xffd166)]));
  } else if (unit.designId === 'd_skyspike') {
    root.addChild(rect(-0.72, -0.6, 1.24, 1.2, 0.18, 0x303945));
    teamParts.push(...add(root, [poly([0.42, 0, -0.24, 0.36, -0.48, 0, -0.24, -0.36], 0xffffff)]));
    accentParts.push(...add(root, [rect(0.02, -0.74, 0.42, 0.18, 0.04, 0xffd166), rect(0.02, 0.56, 0.42, 0.18, 0.04, 0xffd166)]));
  } else {
    root.addChild(rect(-0.74, -0.56, 1.36, 1.12, 0.2, 0x303945));
    teamParts.push(...add(root, [rect(-0.44, -0.34, 0.82, 0.68, 0.1, 0xffffff)]));
  }

  return { root, teamParts, accentParts, rotates: true };
}

function aerialModel(unit: ResolvedUnit): UnitModel {
  const root = new Container();
  const teamParts: Graphics[] = [];
  const accentParts: Graphics[] = [];

  if (unit.designId === 'd_monsoon') {
    root.addChild(poly([1.05, 0, -0.16, 0.42, -0.96, 0.84, -0.68, 0.08, -0.96, -0.84, -0.16, -0.42], 0x303946));
    teamParts.push(...add(root, [poly([0.58, 0, -0.24, 0.26, -0.48, 0, -0.24, -0.26], 0xffffff)]));
    accentParts.push(...add(root, [circle(-0.72, -0.58, 0.13, 0x7df9ff), circle(-0.72, 0.58, 0.13, 0x7df9ff)]));
  } else {
    root.addChild(poly([1.08, 0, -0.22, 0.34, -0.88, 0.74, -0.52, 0, -0.88, -0.74, -0.22, -0.34], 0x303946));
    teamParts.push(...add(root, [poly([0.64, 0, -0.18, 0.22, -0.42, 0, -0.18, -0.22], 0xffffff)]));
    accentParts.push(...add(root, [rect(-0.78, -0.08, 0.22, 0.16, 0.04, 0x7df9ff)]));
  }
  root.addChild(strokePoly([1.08, 0, -0.22, 0.34, -0.88, 0.74, -0.52, 0, -0.88, -0.74, -0.22, -0.34], 0.08, 0x8a96a8, 0.45));

  return { root, teamParts, accentParts, rotates: true };
}

function bioformModel(unit: ResolvedUnit): UnitModel {
  const root = new Container();
  const teamParts: Graphics[] = [];
  const accentParts: Graphics[] = [];
  const elder = unit.designId === 'd_broodling';

  root.addChild(circle(0, 0.18, 0.86, 0x10150f, 0.65));
  root.addChild(poly([0.82, 0, 0.38, 0.58, -0.38, 0.72, -0.86, 0.24, -0.86, -0.24, -0.38, -0.72, 0.38, -0.58], elder ? 0x334129 : 0x2d3a25));
  teamParts.push(...add(root, [poly([0.5, 0, 0.16, 0.34, -0.26, 0.42, -0.54, 0, -0.26, -0.42, 0.16, -0.34], 0xffffff)]));
  accentParts.push(...add(root, [
    circle(0.2, -0.28, elder ? 0.16 : 0.12, 0xb8ff72),
    circle(0.2, 0.28, elder ? 0.16 : 0.12, 0xb8ff72),
    rect(-0.78, -0.52, 0.28, 0.12, 0.04, 0x7aa84f),
    rect(-0.78, 0.4, 0.28, 0.12, 0.04, 0x7aa84f),
  ]));

  return { root, teamParts, accentParts, rotates: true };
}

export function buildUnitModel(unit: ResolvedUnit): UnitModel {
  if (unit.division === 'infantry') return infantryModel(unit);
  if (unit.division === 'mechanized') return mechanizedModel(unit);
  if (unit.division === 'aerial') return aerialModel(unit);
  return bioformModel(unit);
}
