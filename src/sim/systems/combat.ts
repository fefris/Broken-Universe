import type { FireMode, ResolvedWeapon } from '../../content/schema';
import { TARGETING_INTERVAL, TICKS_PER_SECOND } from '../constants';
import { computeDamage } from '../damage';
import { type UnitState, type World, dist, domainOf } from '../types';

const DT = 1 / TICKS_PER_SECOND;
/** Targets further than this multiple of view range are dropped. */
const TARGET_DROP_MULT = 1.25;

const scratchIds: number[] = [];

export function modeFor(weapon: ResolvedWeapon, domain: 'ground' | 'air'): FireMode | undefined {
  return domain === 'air' ? weapon.air : weapon.ground;
}

export function canHit(unit: UnitState, target: UnitState): boolean {
  const domain = domainOf(target);
  return unit.stats.weapons.some((w) => modeFor(w, domain) !== undefined);
}

export function applyDamage(world: World, target: UnitState, amount: number, sourceId = -1): void {
  if (!target.alive) return;
  target.hp -= amount;
  world.events.push({ type: 'unitDamaged', unitId: target.id, amount });
  const source = sourceId >= 0 ? world.units[sourceId] : undefined;
  if (source) source.damageDealt += amount;
  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    if (source) source.kills += 1;
    world.events.push({ type: 'unitDied', unitId: target.id, pos: { ...target.pos } });
  }
}

function acquireTarget(world: World, unit: UnitState): void {
  const commander = world.commanders[unit.commanderId];
  const focusId = commander?.focusTargetId ?? -1;

  // Validate / drop current target.
  if (unit.targetId >= 0) {
    const current = world.units[unit.targetId];
    if (
      !current?.alive ||
      !canHit(unit, current) ||
      dist(unit.pos, current.pos) > unit.stats.viewRange * TARGET_DROP_MULT
    ) {
      unit.targetId = -1;
    }
  }

  // Explicit attack order pins the target while it lives.
  if (unit.order.kind === 'attackTarget') {
    const ordered = world.units[unit.order.targetId];
    if (ordered?.alive && canHit(unit, ordered)) {
      unit.targetId = ordered.id;
      return;
    }
    unit.order = { kind: 'idle' };
  }

  world.grid.queryCircle(unit.pos, unit.stats.viewRange, scratchIds);
  let bestId = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const id of scratchIds) {
    const candidate = world.units[id];
    if (!candidate?.alive || candidate.team === unit.team || !canHit(unit, candidate)) continue;
    const d = dist(unit.pos, candidate.pos);
    if (d > unit.stats.viewRange) continue;
    const range = unit.stats.weapons.reduce((best, w) => {
      const mode = modeFor(w, domainOf(candidate));
      return mode && mode.range > best ? mode.range : best;
    }, 0);
    let score = -d * 10;
    if (id === focusId) score += 1000;
    if (d <= range) score += 500;
    if (id === unit.targetId) score += 200;
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  if (bestId >= 0) unit.targetId = bestId;
}

function tryFire(world: World, unit: UnitState, target: UnitState): void {
  const domain = domainOf(target);
  const d = dist(unit.pos, target.pos);
  for (let wi = 0; wi < unit.stats.weapons.length; wi++) {
    const weapon = unit.stats.weapons[wi]!;
    if ((unit.weaponCooldowns[wi] ?? 0) > 0) continue;
    const mode = modeFor(weapon, domain);
    if (!mode) continue;
    if (d > mode.range + target.stats.radius) continue;
    if (mode.minRange !== undefined && d < mode.minRange) continue;
    if (unit.energy < weapon.energyPerShot) continue;
    // Direct fire between two ground units needs line of sight.
    if (
      !weapon.indirect &&
      unit.stats.locomotion !== 'air' &&
      domain === 'ground' &&
      !world.map.los(unit.pos, target.pos)
    ) {
      continue;
    }

    unit.energy -= weapon.energyPerShot;
    unit.weaponCooldowns[wi] = Math.round(mode.cooldown * TICKS_PER_SECOND);
    unit.facing = Math.atan2(target.pos.y - unit.pos.y, target.pos.x - unit.pos.x);

    if (weapon.projectileSpeed === undefined) {
      const dmg = computeDamage(
        mode.damage,
        weapon.damageType,
        target.stats.armor,
        target.stats.armorClass,
      );
      applyDamage(world, target, dmg, unit.id);
      world.events.push({
        type: 'weaponFired',
        unitId: unit.id,
        targetId: target.id,
        from: { ...unit.pos },
        to: { ...target.pos },
        hitscan: true,
      });
    } else {
      const splash = mode.splashRadius ?? 0;
      let impactPoint: { x: number; y: number } | null = null;
      if (splash > 0) {
        // Locked, lightly-led impact point: fast targets dodge artillery.
        const flightTime = d / weapon.projectileSpeed;
        const velX = (target.pos.x - target.prevPos.x) / DT;
        const velY = (target.pos.y - target.prevPos.y) / DT;
        impactPoint = {
          x: target.pos.x + velX * flightTime * 0.5,
          y: target.pos.y + velY * flightTime * 0.5,
        };
      }
      world.projectiles.push({
        id: world.nextProjectileId++,
        pos: { ...unit.pos },
        prevPos: { ...unit.pos },
        speed: weapon.projectileSpeed,
        damage: mode.damage,
        damageType: weapon.damageType,
        sourceTeam: unit.team,
        sourceId: unit.id,
        targetDomain: domain,
        splashRadius: splash,
        homingTargetId: splash > 0 ? -1 : target.id,
        impactPoint,
      });
      world.events.push({
        type: 'weaponFired',
        unitId: unit.id,
        targetId: target.id,
        from: { ...unit.pos },
        to: { ...target.pos },
        hitscan: false,
      });
    }
  }
}

function repairAndRegen(world: World, unit: UnitState): void {
  const { stats } = unit;
  if (stats.regenHps > 0 && unit.hp < stats.maxHealth) {
    unit.hp = Math.min(stats.maxHealth, unit.hp + stats.regenHps * DT);
  }
  if (stats.repair) {
    world.grid.queryCircle(unit.pos, stats.repair.range, scratchIds);
    let best: UnitState | null = null;
    let bestRatio = 1;
    for (const id of scratchIds) {
      if (id === unit.id) continue;
      const ally = world.units[id];
      if (!ally?.alive || ally.team !== unit.team) continue;
      if (dist(unit.pos, ally.pos) > stats.repair.range) continue;
      const ratio = ally.hp / ally.stats.maxHealth;
      if (ratio < bestRatio) {
        bestRatio = ratio;
        best = ally;
      }
    }
    if (best && bestRatio < 1) {
      const amount = Math.min(stats.repair.hps * DT, best.stats.maxHealth - best.hp);
      best.hp += amount;
      world.events.push({ type: 'unitHealed', unitId: best.id, amount });
    }
  }
}

export function combatSystem(world: World): void {
  for (const unit of world.units) {
    if (!unit.alive) continue;

    // Energy regen and cooldowns every tick.
    const net = (unit.stats.energyRecharge - unit.stats.passiveDrain) * DT;
    unit.energy = Math.min(unit.stats.energyMax, Math.max(0, unit.energy + net));
    for (let i = 0; i < unit.weaponCooldowns.length; i++) {
      const cd = unit.weaponCooldowns[i]!;
      if (cd > 0) unit.weaponCooldowns[i] = cd - 1;
    }

    repairAndRegen(world, unit);

    if ((world.tick + unit.id) % TARGETING_INTERVAL === 0) {
      acquireTarget(world, unit);
    }

    if (unit.targetId < 0) continue;
    const target = world.units[unit.targetId];
    if (!target?.alive) {
      unit.targetId = -1;
      continue;
    }
    tryFire(world, unit, target);
  }
}
