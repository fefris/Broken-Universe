import type { ResolvedUnit } from '../content/schema';
import type { Command } from './commands';
import { BATTLE_DURATION_TICKS, secondsToTicks } from './constants';
import type { MapDef } from './map/maps';
import { findPath } from './map/pathfinding';
import { createRng } from './rng';
import { SpatialGrid } from './spatial';
import { captureSystem } from './systems/capture';
import { combatSystem } from './systems/combat';
import { movementSystem } from './systems/movement';
import { projectileSystem } from './systems/projectiles';
import { deployReserve, spawnUnit } from './systems/reserves';
import { victorySystem } from './systems/victory';
import { DEFENDER, type Team, type UnitState, type Vec2, type World } from './types';

export interface CommanderSetup {
  team: Team;
  name: string;
  isPlayer?: boolean;
  squadDesignIds: string[];
  reserveDesignIds: string[];
  squadCap?: number;
}

export interface BattleConfig {
  seed: number;
  mapDef: MapDef;
  commanders: CommanderSetup[];
  /** Baked stats per design id (from the content DB, or fixtures in tests). */
  resolve: (designId: string) => ResolvedUnit;
  durationTicks?: number;
}

export function createBattle(config: BattleConfig): World {
  const durationTicks = config.durationTicks ?? BATTLE_DURATION_TICKS;
  const world: World = {
    tick: 0,
    rng: createRng(config.seed),
    map: config.mapDef.map,
    units: [],
    commanders: [],
    pocs: config.mapDef.pocs.map((p, i) => ({
      id: i,
      label: p.label,
      pos: { ...p.pos },
      radius: p.radius,
      captureTicks: secondsToTicks(p.captureSeconds),
      progress: 0,
      owner: DEFENDER,
    })),
    projectiles: [],
    spawnZones: config.mapDef.spawnZones,
    events: [],
    grid: new SpatialGrid(config.mapDef.map.widthMeters, config.mapDef.map.heightMeters),
    durationTicks,
    // Reinforcements close for the final stretch — a fixed 3 minutes on a full
    // battle, but proportionally shorter on briefer ones so short battles still
    // allow most of their length for deploying waves.
    reinforceCutoffTick: Math.max(
      0,
      durationTicks - Math.min(secondsToTicks(180), Math.floor(durationTicks * 0.2)),
    ),
    result: null,
    nextProjectileId: 0,
  };

  for (const [index, setup] of config.commanders.entries()) {
    const commander = {
      id: index,
      team: setup.team,
      name: setup.name,
      isPlayer: setup.isPlayer ?? false,
      squad: [],
      reserves: [...setup.reserveDesignIds],
      squadCap: setup.squadCap ?? Math.max(setup.squadDesignIds.length, 6),
      focusTargetId: -1,
      intent: null,
    };
    world.commanders.push(commander);
    for (const designId of setup.squadDesignIds) {
      spawnUnit(world, commander, config.resolve(designId), false);
    }
  }
  world.grid.rebuild(world.units);
  return world;
}

/** Ring formation offsets so squad members spread around a shared goal. */
function formationOffset(index: number): Vec2 {
  if (index === 0) return { x: 0, y: 0 };
  const ring = index <= 6 ? 1 : index <= 18 ? 2 : 3;
  const ringStart = ring === 1 ? 1 : ring === 2 ? 7 : 19;
  const ringSize = ring === 1 ? 6 : ring === 2 ? 12 : 18;
  const angle = ((index - ringStart) / ringSize) * Math.PI * 2;
  const radius = ring * 2.4;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function orderUnits(
  world: World,
  commanderId: number,
  unitIds: number[],
  apply: (unit: UnitState, index: number) => void,
): void {
  let index = 0;
  for (const id of unitIds) {
    const unit = world.units[id];
    if (!unit?.alive || unit.commanderId !== commanderId) continue;
    apply(unit, index++);
  }
}

function applyCommand(world: World, command: Command, resolve: BattleConfig['resolve']): void {
  switch (command.type) {
    case 'move':
    case 'attackMove': {
      orderUnits(world, command.commanderId, command.unitIds, (unit, index) => {
        unit.order = { kind: command.type, goal: { ...command.goal } };
        unit.formationOffset = formationOffset(index);
        unit.microGoal = null;
        unit.pathIndex = 0;
        unit.path =
          unit.stats.locomotion === 'air' ? null : findPath(world.map, unit.pos, command.goal);
        if (command.type === 'move') unit.targetId = -1;
      });
      break;
    }
    case 'attackTarget': {
      const target = world.units[command.targetId];
      if (!target?.alive) break;
      orderUnits(world, command.commanderId, command.unitIds, (unit) => {
        unit.order = { kind: 'attackTarget', targetId: command.targetId };
        unit.targetId = command.targetId;
        unit.microGoal = null;
        unit.path = null;
      });
      break;
    }
    case 'stop': {
      orderUnits(world, command.commanderId, command.unitIds, (unit) => {
        unit.order = { kind: 'idle' };
        unit.path = null;
        unit.microGoal = null;
      });
      break;
    }
    case 'setFocusTarget': {
      const commander = world.commanders[command.commanderId];
      if (commander) commander.focusTargetId = command.targetId;
      break;
    }
    case 'deploy': {
      const commander = world.commanders[command.commanderId];
      if (commander) deployReserve(world, commander, command.designId, resolve);
      break;
    }
  }
}

/**
 * Advance the world one fixed 50ms step. All input (player and AI) arrives
 * as commands; system order is fixed for determinism.
 */
export function tick(world: World, commands: Command[], resolve: BattleConfig['resolve']): void {
  if (world.result) return;
  world.events.length = 0;

  for (const unit of world.units) {
    unit.prevPos.x = unit.pos.x;
    unit.prevPos.y = unit.pos.y;
  }

  for (const command of commands) applyCommand(world, command, resolve);

  world.grid.rebuild(world.units);
  movementSystem(world);
  world.grid.rebuild(world.units);
  combatSystem(world);
  projectileSystem(world);
  captureSystem(world);
  victorySystem(world);
  world.tick++;
}

/** Deterministic snapshot of everything gameplay-relevant, for tests. */
export function serializeWorld(world: World): string {
  return JSON.stringify({
    tick: world.tick,
    rng: world.rng.state(),
    units: world.units.map((u) => ({
      id: u.id,
      pos: u.pos,
      hp: Math.round(u.hp * 1000) / 1000,
      energy: Math.round(u.energy * 1000) / 1000,
      alive: u.alive,
      targetId: u.targetId,
      order: u.order,
      cooldowns: u.weaponCooldowns,
    })),
    pocs: world.pocs.map((p) => ({ id: p.id, owner: p.owner, progress: p.progress })),
    projectiles: world.projectiles.map((p) => ({ id: p.id, pos: p.pos })),
    commanders: world.commanders.map((c) => ({
      id: c.id,
      reserves: c.reserves,
      focus: c.focusTargetId,
      intent: c.intent,
    })),
    result: world.result,
  });
}
