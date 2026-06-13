import type { Graphics } from 'pixi.js';
import type { SimEvent } from '../sim/events';
import type { Vec2, World } from '../sim/types';
import { COLOR_TRACER, TEAM_COLORS } from './colors';

interface Effect {
  kind: 'tracer' | 'boom' | 'death' | 'ping';
  a: Vec2;
  b?: Vec2;
  radius: number;
  color: number;
  born: number;
  ttl: number;
}

/** Short-lived visual effects fed by sim events, drawn into one Graphics. */
export class FxLayer {
  private effects: Effect[] = [];

  /** A command ping: a ring converging on the clicked spot (player order feedback). */
  ping(pos: Vec2, now: number, color: number): void {
    this.effects.push({ kind: 'ping', a: { ...pos }, radius: 4.5, color, born: now, ttl: 520 });
  }

  ingest(events: readonly SimEvent[], world: World, now: number): void {
    for (const e of events) {
      switch (e.type) {
        case 'weaponFired': {
          if (!e.hitscan) break;
          this.effects.push({
            kind: 'tracer',
            a: { ...e.from },
            b: { ...e.to },
            radius: 0,
            color: COLOR_TRACER,
            born: now,
            ttl: 110,
          });
          break;
        }
        case 'projectileDetonated': {
          this.effects.push({
            kind: 'boom',
            a: { ...e.pos },
            radius: Math.max(1.2, e.splashRadius),
            color: 0xffb347,
            born: now,
            ttl: e.splashRadius > 0 ? 350 : 180,
          });
          break;
        }
        case 'unitDied': {
          const unit = world.units[e.unitId];
          this.effects.push({
            kind: 'death',
            a: { ...e.pos },
            radius: (unit?.stats.radius ?? 1) * 2,
            color: unit ? TEAM_COLORS[unit.team] : 0xffffff,
            born: now,
            ttl: 550,
          });
          break;
        }
        default:
          break;
      }
    }
  }

  draw(g: Graphics, now: number): void {
    g.clear();
    const survivors: Effect[] = [];
    for (const fx of this.effects) {
      const t = (now - fx.born) / fx.ttl;
      if (t >= 1) continue;
      survivors.push(fx);
      const fade = 1 - t;
      switch (fx.kind) {
        case 'tracer':
          if (fx.b) {
            g.moveTo(fx.a.x, fx.a.y)
              .lineTo(fx.b.x, fx.b.y)
              .stroke({ width: 0.25, color: fx.color, alpha: 0.85 * fade });
          }
          break;
        case 'boom': {
          const r = fx.radius * (0.4 + 0.6 * t);
          g.circle(fx.a.x, fx.a.y, r).fill({ color: fx.color, alpha: 0.5 * fade });
          g.circle(fx.a.x, fx.a.y, r).stroke({ width: 0.2, color: 0xfff0c0, alpha: fade });
          break;
        }
        case 'death': {
          const r = fx.radius * (0.5 + 1.1 * t);
          g.circle(fx.a.x, fx.a.y, r).stroke({ width: 0.3, color: fx.color, alpha: 0.8 * fade });
          g.circle(fx.a.x, fx.a.y, fx.radius * 0.5 * fade).fill({
            color: 0xffffff,
            alpha: 0.35 * fade,
          });
          break;
        }
        case 'ping': {
          // A ring that shrinks onto the clicked point, plus a center pip and ticks.
          const ringR = Math.max(0.1, fx.radius * fade);
          g.circle(fx.a.x, fx.a.y, ringR).stroke({ width: 0.32, color: fx.color, alpha: fade });
          g.circle(fx.a.x, fx.a.y, 0.7).fill({ color: fx.color, alpha: 0.9 * fade });
          const tick = 0.9;
          for (const d of [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 },
          ]) {
            g.moveTo(fx.a.x + d.x * ringR, fx.a.y + d.y * ringR)
              .lineTo(fx.a.x + d.x * (ringR + tick), fx.a.y + d.y * (ringR + tick))
              .stroke({ width: 0.3, color: fx.color, alpha: fade });
          }
          break;
        }
      }
    }
    this.effects = survivors;
  }
}
