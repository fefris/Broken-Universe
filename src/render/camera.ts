import type { Container } from 'pixi.js';
import { PIXELS_PER_METER } from '../sim/constants';
import type { Vec2 } from '../sim/types';

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 2.5;

/** Camera position is in meters (world space); zoom multiplies base PPM. */
export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  screenW = 1;
  screenH = 1;

  constructor(
    private readonly mapW: number,
    private readonly mapH: number,
  ) {}

  get scale(): number {
    return PIXELS_PER_METER * this.zoom;
  }

  resize(w: number, h: number): void {
    this.screenW = w;
    this.screenH = h;
    this.clamp();
  }

  centerOn(pos: Vec2): void {
    this.x = pos.x;
    this.y = pos.y;
    this.clamp();
  }

  pan(dxPixels: number, dyPixels: number): void {
    this.x += dxPixels / this.scale;
    this.y += dyPixels / this.scale;
    this.clamp();
  }

  /** Zoom keeping the world point under the cursor fixed. */
  zoomAt(factor: number, sx: number, sy: number): void {
    const before = this.screenToWorld(sx, sy);
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clamp();
  }

  screenToWorld(sx: number, sy: number): Vec2 {
    return {
      x: this.x + (sx - this.screenW / 2) / this.scale,
      y: this.y + (sy - this.screenH / 2) / this.scale,
    };
  }

  worldToScreen(pos: Vec2): Vec2 {
    return {
      x: (pos.x - this.x) * this.scale + this.screenW / 2,
      y: (pos.y - this.y) * this.scale + this.screenH / 2,
    };
  }

  apply(root: Container): void {
    root.scale.set(this.scale);
    root.position.set(
      this.screenW / 2 - this.x * this.scale,
      this.screenH / 2 - this.y * this.scale,
    );
  }

  private clamp(): void {
    const halfW = this.screenW / 2 / this.scale;
    const halfH = this.screenH / 2 / this.scale;
    // Allow a little margin so spawn zones at the edge are comfortable.
    const margin = 10;
    this.x = Math.min(this.mapW + margin - halfW, Math.max(halfW - margin, this.x));
    this.y = Math.min(this.mapH + margin - halfH, Math.max(halfH - margin, this.y));
    if (this.mapW + 2 * margin < 2 * halfW) this.x = this.mapW / 2;
    if (this.mapH + 2 * margin < 2 * halfH) this.y = this.mapH / 2;
  }
}
