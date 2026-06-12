import { TICKS_PER_SECOND } from '../constants';
import { computeDamage } from '../damage';
import { type Projectile, type World, dist, domainOf } from '../types';
import { applyDamage } from './combat';

const DT = 1 / TICKS_PER_SECOND;

const scratchIds: number[] = [];

function detonate(world: World, proj: Projectile): void {
  world.events.push({
    type: 'projectileDetonated',
    pos: { ...proj.pos },
    splashRadius: proj.splashRadius,
  });
  world.grid.queryCircle(proj.pos, proj.splashRadius, scratchIds);
  for (const id of scratchIds) {
    const unit = world.units[id];
    if (!unit?.alive || unit.team === proj.sourceTeam) continue;
    if (domainOf(unit) !== proj.targetDomain) continue;
    if (dist(unit.pos, proj.pos) > proj.splashRadius + unit.stats.radius) continue;
    applyDamage(
      world,
      unit,
      computeDamage(proj.damage, proj.damageType, unit.stats.armor, unit.stats.armorClass),
    );
  }
}

export function projectileSystem(world: World): void {
  const survivors: Projectile[] = [];
  for (const proj of world.projectiles) {
    proj.prevPos = { ...proj.pos };
    const step = proj.speed * DT;

    let dest: { x: number; y: number } | null = null;
    if (proj.homingTargetId >= 0) {
      const target = world.units[proj.homingTargetId];
      if (!target?.alive) continue; // fizzle: target died mid-flight
      dest = target.pos;
      if (dist(proj.pos, dest) <= step + target.stats.radius) {
        applyDamage(
          world,
          target,
          computeDamage(proj.damage, proj.damageType, target.stats.armor, target.stats.armorClass),
        );
        world.events.push({ type: 'projectileDetonated', pos: { ...dest }, splashRadius: 0 });
        continue;
      }
    } else if (proj.impactPoint) {
      dest = proj.impactPoint;
      if (dist(proj.pos, dest) <= step) {
        proj.pos = { ...dest };
        detonate(world, proj);
        continue;
      }
    } else {
      continue; // malformed projectile, drop it
    }

    const dx = dest.x - proj.pos.x;
    const dy = dest.y - proj.pos.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    proj.pos.x += (dx / d) * step;
    proj.pos.y += (dy / d) * step;
    survivors.push(proj);
  }
  world.projectiles = survivors;
}
