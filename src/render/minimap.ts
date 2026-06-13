import { Container, Graphics } from 'pixi.js';
import { TILE_SIZE } from '../sim/constants';
import { TILE_BLOCKED, TILE_SLOW } from '../sim/map/tilemap';
import type { Vec2, World } from '../sim/types';
import type { Camera } from './camera';
import { COLOR_BLOCKED, COLOR_SLOW, TEAM_COLORS } from './colors';

const WIDTH = 208;

/** Screen-fixed minimap: baked terrain, live unit dots, viewport rect. */
export class Minimap {
  readonly container = new Container();
  readonly widthPx = WIDTH;
  readonly heightPx: number;
  /** Pixels per meter on the minimap. */
  private readonly k: number;
  private readonly dynamic = new Graphics();
  screenX = 12;
  screenY = 12;

  constructor(
    world: World,
    private readonly onNavigate: (pos: Vec2) => void,
  ) {
    this.k = WIDTH / world.map.widthMeters;
    this.heightPx = Math.round(world.map.heightMeters * this.k);

    const terrain = new Graphics();
    terrain.rect(0, 0, WIDTH, this.heightPx).fill({ color: 0x10141a, alpha: 0.92 });
    for (let ty = 0; ty < world.map.rows; ty++) {
      for (let tx = 0; tx < world.map.cols; tx++) {
        const tile = world.map.tileAt(tx, ty);
        if (tile === TILE_BLOCKED || tile === TILE_SLOW) {
          terrain
            .rect(
              tx * TILE_SIZE * this.k,
              ty * TILE_SIZE * this.k,
              TILE_SIZE * this.k,
              TILE_SIZE * this.k,
            )
            .fill(tile === TILE_BLOCKED ? COLOR_BLOCKED : COLOR_SLOW);
        }
      }
    }
    terrain.rect(0, 0, WIDTH, this.heightPx).stroke({ width: 1.5, color: 0x4a5564 });
    for (const portal of world.portals) {
      terrain
        .rect(portal.pos.x * this.k - 1.5, portal.pos.y * this.k - 1.5, 3, 3)
        .fill({ color: 0x9fb0c4, alpha: 0.55 });
    }
    this.container.addChild(terrain, this.dynamic);
  }

  layout(_screenW: number, screenH: number): void {
    this.screenX = 12;
    this.screenY = screenH - this.heightPx - 12;
    this.container.position.set(this.screenX, this.screenY);
  }

  /** Returns true when the screen point hit the minimap (and navigated). */
  handleClick(sx: number, sy: number): boolean {
    const lx = sx - this.screenX;
    const ly = sy - this.screenY;
    if (lx < 0 || ly < 0 || lx > this.widthPx || ly > this.heightPx) return false;
    this.onNavigate({ x: lx / this.k, y: ly / this.k });
    return true;
  }

  draw(world: World, camera: Camera): void {
    const g = this.dynamic;
    g.clear();
    for (const poc of world.pocs) {
      g.circle(poc.pos.x * this.k, poc.pos.y * this.k, poc.radius * this.k).stroke({
        width: 1,
        color: TEAM_COLORS[poc.owner],
        alpha: 0.9,
      });
    }
    for (const unit of world.units) {
      if (!unit.alive) continue;
      g.rect(unit.pos.x * this.k - 1, unit.pos.y * this.k - 1, 2.4, 2.4).fill(
        TEAM_COLORS[unit.team],
      );
    }
    // Viewport rectangle.
    const tl = camera.screenToWorld(0, 0);
    const br = camera.screenToWorld(camera.screenW, camera.screenH);
    g.rect(tl.x * this.k, tl.y * this.k, (br.x - tl.x) * this.k, (br.y - tl.y) * this.k).stroke({
      width: 1,
      color: 0xe8eef5,
      alpha: 0.8,
    });
  }
}
