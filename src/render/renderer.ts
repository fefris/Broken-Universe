import {
  type Application,
  Container,
  Graphics,
  GraphicsContext,
  Sprite,
  Text,
  Texture,
} from 'pixi.js';
import { ATTACKER, type PoC, type UnitState, type World } from '../sim/types';
import { Camera } from './camera';
import { TEAM_COLORS, hpColor, teamColor } from './colors';
import { FxLayer } from './fx';
import { drawPocModel, drawSpawnZoneModel, drawTerrainModel } from './mapModels';
import { Minimap } from './minimap';
import { type UnitModel, buildUnitModel } from './unitModels';

interface UnitView {
  root: Container;
  shadow: Graphics | null;
  model: UnitModel;
  hpBg: Sprite;
  hpFg: Sprite;
  ring: Graphics;
  lastAlive: boolean;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** All world drawing happens in METERS; the camera scales to pixels. */
export class GameRenderer {
  readonly camera: Camera;
  readonly fx = new FxLayer();
  readonly minimap: Minimap;

  private readonly worldRoot = new Container();
  private readonly unitLayer = new Container();
  private readonly projectileLayer = new Container();
  private readonly pocLayer = new Container();
  private readonly overlayLayer = new Container();
  private readonly fxGraphics = new Graphics();

  private readonly ringContext: GraphicsContext;
  private readonly projectileContext: GraphicsContext;
  private readonly unitViews = new Map<number, UnitView>();
  private readonly projectileViews = new Map<number, Graphics>();
  private readonly pocGraphics: Graphics;
  private readonly pocLabels: Text[] = [];

  constructor(
    private readonly app: Application,
    world: World,
    private readonly playerCommanderId: number | null,
  ) {
    this.camera = new Camera(world.map.widthMeters, world.map.heightMeters);

    this.ringContext = new GraphicsContext()
      .circle(0, 0, 1)
      .stroke({ width: 0.18, color: 0xffffff });
    this.projectileContext = new GraphicsContext().circle(0, 0, 0.35).fill(0xffffff);

    // Terrain baked once.
    const terrain = new Graphics();
    drawTerrainModel(terrain, world);
    for (const zone of world.spawnZones) drawSpawnZoneModel(terrain, zone);

    this.pocGraphics = new Graphics();
    this.pocLayer.addChild(this.pocGraphics);
    for (const poc of world.pocs) {
      const label = new Text({
        text: poc.label,
        style: { fill: 0xdde5ee, fontSize: 13, fontFamily: 'system-ui, sans-serif' },
      });
      label.anchor.set(0.5);
      label.position.set(poc.pos.x, poc.pos.y - poc.radius - 3);
      label.scale.set(1 / 8); // text authored in px, world in meters
      this.pocLabels.push(label);
      this.pocLayer.addChild(label);
    }

    this.worldRoot.addChild(
      terrain,
      this.pocLayer,
      this.unitLayer,
      this.projectileLayer,
      this.fxGraphics,
      this.overlayLayer,
    );
    app.stage.addChild(this.worldRoot);

    this.minimap = new Minimap(world, (pos) => this.camera.centerOn(pos));
    app.stage.addChild(this.minimap.container);

    this.resize();
  }

  resize(): void {
    this.camera.resize(this.app.screen.width, this.app.screen.height);
    this.minimap.layout(this.app.screen.width, this.app.screen.height);
  }

  private buildUnitView(unit: UnitState): UnitView {
    const root = new Container();
    const isAir = unit.stats.locomotion === 'air';
    let shadow: Graphics | null = null;
    if (isAir) {
      shadow = new Graphics();
      shadow.ellipse(0, 0, unit.stats.radius * 0.95, unit.stats.radius * 0.45).fill(0x000000);
      shadow.tint = 0x000000;
      shadow.alpha = 0.28;
      root.addChild(shadow);
    }
    const model = buildUnitModel(unit.stats);
    model.root.scale.set(unit.stats.radius);
    if (isAir) model.root.position.y = -1.4;
    root.addChild(model.root);

    const ring = new Graphics(this.ringContext);
    ring.scale.set(unit.stats.radius + 0.45);
    ring.visible = false;
    root.addChild(ring);

    const barW = Math.max(2.2, unit.stats.radius * 2.4);
    const hpBg = new Sprite(Texture.WHITE);
    hpBg.tint = 0x000000;
    hpBg.alpha = 0.55;
    hpBg.width = barW;
    hpBg.height = 0.34;
    hpBg.position.set(-barW / 2, -(unit.stats.radius + 1.3));
    const hpFg = new Sprite(Texture.WHITE);
    hpFg.width = barW;
    hpFg.height = 0.34;
    hpFg.position.set(-barW / 2, -(unit.stats.radius + 1.3));
    root.addChild(hpBg, hpFg);

    this.unitLayer.addChild(root);
    const view: UnitView = { root, shadow, model, hpBg, hpFg, ring, lastAlive: true };
    this.unitViews.set(unit.id, view);
    return view;
  }

  private drawPocs(pocs: PoC[]): void {
    const g = this.pocGraphics;
    g.clear();
    for (const poc of pocs) {
      drawPocModel(g, poc, TEAM_COLORS[ATTACKER]);
    }
  }

  /** Per-frame draw: interpolates between prevPos and pos with alpha. */
  draw(world: World, alpha: number, selection: ReadonlySet<number>, now: number): void {
    this.camera.apply(this.worldRoot);

    for (const unit of world.units) {
      let view = this.unitViews.get(unit.id);
      if (!view) view = this.buildUnitView(unit);

      if (!unit.alive) {
        if (view.lastAlive) {
          view.root.visible = false;
          view.lastAlive = false;
        }
        continue;
      }

      const x = lerp(unit.prevPos.x, unit.pos.x, alpha);
      const y = lerp(unit.prevPos.y, unit.pos.y, alpha);
      view.root.position.set(x, y);
      view.root.visible = true;
      view.lastAlive = true;

      const isPlayerUnit =
        this.playerCommanderId !== null && unit.commanderId === this.playerCommanderId;
      for (const part of view.model.teamParts) part.tint = teamColor(unit.team, isPlayerUnit);
      if (unit.stats.division !== 'infantry') {
        view.model.root.rotation = unit.facing;
        if (view.shadow) view.shadow.rotation = unit.facing;
      } else {
        view.model.root.rotation = unit.facing;
      }

      const ratio = unit.hp / unit.stats.maxHealth;
      const damaged = ratio < 0.999;
      view.hpBg.visible = damaged;
      view.hpFg.visible = damaged;
      if (damaged) {
        view.hpFg.width = Math.max(2.2, unit.stats.radius * 2.4) * ratio;
        view.hpFg.tint = hpColor(ratio);
      }

      const selected = selection.has(unit.id);
      view.ring.visible = selected || isPlayerUnit;
      view.ring.alpha = selected ? 1 : 0.22;
    }

    // Projectiles: sync pool with sim list.
    const seen = new Set<number>();
    for (const proj of world.projectiles) {
      seen.add(proj.id);
      let g = this.projectileViews.get(proj.id);
      if (!g) {
        g = new Graphics(this.projectileContext);
        g.tint = proj.splashRadius > 0 ? 0xffc066 : 0xfff0b0;
        this.projectileLayer.addChild(g);
        this.projectileViews.set(proj.id, g);
      }
      g.position.set(
        lerp(proj.prevPos.x, proj.pos.x, alpha),
        lerp(proj.prevPos.y, proj.pos.y, alpha),
      );
    }
    for (const [id, g] of this.projectileViews) {
      if (!seen.has(id)) {
        g.destroy();
        this.projectileViews.delete(id);
      }
    }

    this.drawPocs(world.pocs);
    this.fx.draw(this.fxGraphics, now);
    this.minimap.draw(world, this.camera);
  }

  destroy(): void {
    this.app.stage.removeChildren();
    this.worldRoot.destroy({ children: true });
    this.minimap.container.destroy({ children: true });
    this.unitViews.clear();
    this.projectileViews.clear();
  }
}
