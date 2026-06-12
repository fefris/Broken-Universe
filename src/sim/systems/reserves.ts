import type { ResolvedUnit } from '../../content/schema';
import { spawnZoneFor } from '../map/maps';
import type { Commander, UnitState, World } from '../types';

export function aliveSquadCount(world: World, commander: Commander): number {
  let count = 0;
  for (const unitId of commander.squad) {
    if (world.units[unitId]?.alive) count++;
  }
  return count;
}

export function canDeploy(world: World, commander: Commander): boolean {
  return (
    world.result === null &&
    world.tick < world.reinforceCutoffTick &&
    commander.reserves.length > 0 &&
    aliveSquadCount(world, commander) < commander.squadCap
  );
}

/** Spawn a fresh unit for the commander inside their team's spawn zone. */
export function spawnUnit(
  world: World,
  commander: Commander,
  stats: ResolvedUnit,
  emitEvent: boolean,
): UnitState {
  const zone = spawnZoneFor(world.spawnZones, commander.team);
  const angle = world.rng.range(0, Math.PI * 2);
  const r = world.rng.range(0, zone.radius * 0.8);
  const pos = world.map.nearestOpen({
    x: zone.center.x + Math.cos(angle) * r,
    y: zone.center.y + Math.sin(angle) * r,
  });
  const unit: UnitState = {
    id: world.units.length,
    commanderId: commander.id,
    team: commander.team,
    stats,
    pos: { ...pos },
    prevPos: { ...pos },
    facing: commander.team === 0 ? 0 : Math.PI,
    hp: stats.maxHealth,
    energy: stats.energyMax,
    alive: true,
    order: { kind: 'idle' },
    path: null,
    pathIndex: 0,
    formationOffset: { x: 0, y: 0 },
    targetId: -1,
    weaponCooldowns: stats.weapons.map(() => 0),
    microGoal: null,
    microUntilTick: 0,
    damageDealt: 0,
    kills: 0,
  };
  world.units.push(unit);
  commander.squad.push(unit.id);
  if (emitEvent) {
    world.events.push({ type: 'unitDeployed', unitId: unit.id, commanderId: commander.id });
  }
  return unit;
}

/** Deploy the first reserve matching designId (or the first reserve at all). */
export function deployReserve(
  world: World,
  commander: Commander,
  designId: string | null,
  resolve: (designId: string) => ResolvedUnit,
): UnitState | null {
  if (!canDeploy(world, commander)) return null;
  const index = designId === null ? 0 : commander.reserves.indexOf(designId);
  if (index < 0) return null;
  const [picked] = commander.reserves.splice(index, 1);
  if (!picked) return null;
  return spawnUnit(world, commander, resolve(picked), true);
}
