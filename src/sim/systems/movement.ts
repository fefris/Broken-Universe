import { TICKS_PER_SECOND } from '../constants';
import { findPath } from '../map/pathfinding';
import { type UnitState, type Vec2, type World, dist, domainOf } from '../types';

const DT = 1 / TICKS_PER_SECOND;
const WAYPOINT_REACHED = 2.0;
const GOAL_REACHED = 1.5;
const SEPARATION_RADIUS = 3.5;
const SEPARATION_STRENGTH = 2.0;
/** How often a unit chasing a moving target re-plans its route around terrain. */
const CHASE_REPATH_TICKS = 20;

const scratchIds: number[] = [];

function getChaseTarget(world: World, unit: UnitState): UnitState | null {
  if (unit.targetId < 0) return null;
  const target = world.units[unit.targetId];
  return target?.alive ? target : null;
}

/** Longest weapon range this unit can bring to bear on the given domain. */
export function bestRangeAgainst(unit: UnitState, domain: 'ground' | 'air'): number | null {
  let best: number | null = null;
  for (const w of unit.stats.weapons) {
    const mode = domain === 'air' ? w.air : w.ground;
    if (mode && (best === null || mode.range > best)) best = mode.range;
  }
  return best;
}

/**
 * How a unit pursues its combat target: 'hold' (positioned to fire — stop and
 * shoot), or a Vec2 goal to move toward when it must close the distance.
 * Units out of range, or in range but with terrain blocking a direct shot,
 * keep advancing instead of freezing — routing around obstacles when blind.
 */
function resolveChase(world: World, unit: UnitState, target: UnitState): Vec2 | 'hold' {
  const domain = domainOf(target);
  const isAir = unit.stats.locomotion === 'air';
  const d = dist(unit.pos, target.pos);
  let los: boolean | null = null;
  const sight = (): boolean => {
    if (los === null) los = isAir || world.map.los(unit.pos, target.pos);
    return los;
  };

  let canFireHere = false;
  let wantCloser = false;
  for (const w of unit.stats.weapons) {
    const mode = domain === 'air' ? w.air : w.ground;
    if (!mode) continue;
    if (mode.minRange !== undefined && d < mode.minRange) continue; // too close for this weapon
    if (d > mode.range) {
      wantCloser = true; // out of range: advance
      continue;
    }
    if (w.indirect || sight())
      canFireHere = true; // in range with a clear shot
    else wantCloser = true; // in range but terrain blocks the shot: reposition
  }

  // Hold when we can fire, or when the only obstacle is being too close to
  // fire anything (advancing would just make point-blank worse).
  if (canFireHere || !wantCloser) {
    unit.path = null;
    return 'hold';
  }

  if (sight()) {
    unit.path = null;
    return target.pos; // clear line: make straight for the target
  }

  // Blind: route around terrain, re-planning periodically as the target moves.
  if (
    !unit.path ||
    unit.path.length === 0 ||
    unit.pathIndex >= unit.path.length ||
    (world.tick + unit.id) % CHASE_REPATH_TICKS === 0
  ) {
    unit.path = findPath(world.map, unit.pos, target.pos);
    unit.pathIndex = 0;
  }
  if (!unit.path || unit.path.length === 0) return target.pos;
  while (
    unit.pathIndex < unit.path.length - 1 &&
    dist(unit.pos, unit.path[unit.pathIndex]!) <= WAYPOINT_REACHED
  ) {
    unit.pathIndex++;
  }
  return unit.path[Math.min(unit.pathIndex, unit.path.length - 1)]!;
}

function separation(world: World, unit: UnitState): Vec2 {
  const out = { x: 0, y: 0 };
  world.grid.queryCircle(unit.pos, SEPARATION_RADIUS, scratchIds);
  const myDomain = domainOf(unit);
  for (const id of scratchIds) {
    if (id === unit.id) continue;
    const other = world.units[id];
    if (!other?.alive || domainOf(other) !== myDomain) continue;
    const dx = unit.pos.x - other.pos.x;
    const dy = unit.pos.y - other.pos.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const minDist = unit.stats.radius + other.stats.radius + 0.4;
    if (d >= minDist) continue;
    if (d < 1e-4) {
      // Perfectly stacked: deterministic nudge by id parity.
      out.x += unit.id > other.id ? 0.5 : -0.5;
      out.y += unit.id > other.id ? 0.3 : -0.3;
      continue;
    }
    const push = ((minDist - d) / minDist) * SEPARATION_STRENGTH;
    out.x += (dx / d) * push;
    out.y += (dy / d) * push;
  }
  return out;
}

export function movementSystem(world: World): void {
  const { map } = world;
  for (const unit of world.units) {
    if (!unit.alive) continue;
    const stats = unit.stats;
    const isAir = stats.locomotion === 'air';

    let goal: Vec2 | null = null;
    let holding = false;

    if (unit.microGoal && world.tick < unit.microUntilTick) {
      goal = unit.microGoal;
    } else {
      unit.microGoal = null;
      // Chase/hold against the current combat target (plain 'move' ignores it).
      const target = unit.order.kind === 'move' ? null : getChaseTarget(world, unit);
      if (target) {
        const chase = resolveChase(world, unit, target);
        if (chase === 'hold') holding = true;
        else goal = chase;
      }

      if (!goal && !holding && (unit.order.kind === 'move' || unit.order.kind === 'attackMove')) {
        const finalGoal = {
          x: unit.order.goal.x + unit.formationOffset.x,
          y: unit.order.goal.y + unit.formationOffset.y,
        };
        if (dist(unit.pos, finalGoal) <= GOAL_REACHED) {
          if (unit.order.kind === 'move') unit.order = { kind: 'idle' };
          unit.path = null;
        } else if (isAir || !unit.path) {
          goal = finalGoal;
        } else {
          while (
            unit.pathIndex < unit.path.length - 1 &&
            dist(unit.pos, unit.path[unit.pathIndex]!) <= WAYPOINT_REACHED
          ) {
            unit.pathIndex++;
          }
          const wp = unit.path[Math.min(unit.pathIndex, unit.path.length - 1)]!;
          goal = unit.pathIndex >= unit.path.length - 1 ? finalGoal : wp;
        }
      }
    }

    // Steering: seek + separation.
    let vx = 0;
    let vy = 0;
    const speedMult = isAir ? 1 : map.speedMultAt(unit.pos);
    const speed = stats.speed * speedMult;
    if (goal && !holding) {
      const dx = goal.x - unit.pos.x;
      const dy = goal.y - unit.pos.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.05) {
        const v = Math.min(speed, d / DT);
        vx = (dx / d) * v;
        vy = (dy / d) * v;
      }
    }
    const sep = separation(world, unit);
    vx += sep.x * speed;
    vy += sep.y * speed;
    const mag = Math.sqrt(vx * vx + vy * vy);
    if (mag > speed) {
      vx = (vx / mag) * speed;
      vy = (vy / mag) * speed;
    }
    if (mag < 1e-4) continue;

    let nx = unit.pos.x + vx * DT;
    let ny = unit.pos.y + vy * DT;

    if (!isAir) {
      // Slide along walls: try full move, then each axis alone.
      if (map.isBlockedWorld({ x: nx, y: ny })) {
        if (!map.isBlockedWorld({ x: nx, y: unit.pos.y })) {
          ny = unit.pos.y;
        } else if (!map.isBlockedWorld({ x: unit.pos.x, y: ny })) {
          nx = unit.pos.x;
        } else {
          continue;
        }
      }
    }
    nx = Math.min(map.widthMeters - 1, Math.max(1, nx));
    ny = Math.min(map.heightMeters - 1, Math.max(1, ny));

    if (Math.abs(vx) > 0.3 || Math.abs(vy) > 0.3) {
      unit.facing = Math.atan2(vy, vx);
    }
    unit.pos.x = nx;
    unit.pos.y = ny;
  }
}
