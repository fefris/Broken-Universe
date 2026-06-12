import type { ResolvedUnit } from '../content/schema';
import type { SimEvent } from './events';
import type { Tilemap } from './map/tilemap';
import type { Rng } from './rng';
import type { SpatialGrid } from './spatial';

export interface Vec2 {
  x: number;
  y: number;
}

/** 0 = attacker, 1 = defender. */
export type Team = 0 | 1;
export const ATTACKER: Team = 0;
export const DEFENDER: Team = 1;

export function otherTeam(team: Team): Team {
  return team === 0 ? 1 : 0;
}

export type Order =
  | { kind: 'idle' }
  | { kind: 'move'; goal: Vec2 }
  | { kind: 'attackMove'; goal: Vec2 }
  | { kind: 'attackTarget'; targetId: number };

export interface UnitState {
  id: number;
  commanderId: number;
  team: Team;
  /** Immutable baked stats, shared per design. */
  stats: ResolvedUnit;
  pos: Vec2;
  prevPos: Vec2;
  /** Radians, render-only smoothing target. */
  facing: number;
  hp: number;
  energy: number;
  alive: boolean;
  order: Order;
  /** Remaining A* waypoints toward the order goal (ground units). */
  path: Vec2[] | null;
  pathIndex: number;
  /** Per-unit offset around the squad goal so units don't stack. */
  formationOffset: Vec2;
  targetId: number;
  /** Per-weapon remaining cooldown in ticks. */
  weaponCooldowns: number[];
  /** Kiting override: while tick < microUntilTick, steer to microGoal. */
  microGoal: Vec2 | null;
  microUntilTick: number;
}

export type IntentKind = 'attackPoc' | 'defendPoc' | 'retreat' | 'rally';

export interface CommanderIntent {
  kind: IntentKind;
  pocId: number;
}

export interface Commander {
  id: number;
  team: Team;
  name: string;
  isPlayer: boolean;
  /** Unit ids ever deployed for this commander (dead ones stay listed). */
  squad: number[];
  /** Design ids awaiting deployment. */
  reserves: string[];
  /** Max simultaneously alive units. */
  squadCap: number;
  /** Squad-wide focus-fire target chosen by micro AI (-1 = none). */
  focusTargetId: number;
  /** Current AI intent, kept in world state for hysteresis + serialization. */
  intent: CommanderIntent | null;
}

export interface PoC {
  id: number;
  label: string;
  pos: Vec2;
  radius: number;
  /** Ticks of uncontested attacker presence needed to flip. */
  captureTicks: number;
  progress: number;
  owner: Team;
}

export interface Projectile {
  id: number;
  pos: Vec2;
  prevPos: Vec2;
  speed: number;
  damage: number;
  damageType: ResolvedUnit['weapons'][number]['damageType'];
  sourceTeam: Team;
  /** Which locomotion domain the warhead harms. */
  targetDomain: 'ground' | 'air';
  splashRadius: number;
  /** Non-splash projectiles home on a unit; splash ones fly to a locked point. */
  homingTargetId: number;
  impactPoint: Vec2 | null;
}

export interface SpawnZone {
  team: Team;
  center: Vec2;
  radius: number;
}

export interface BattleResult {
  winner: Team;
  reason: 'allPocsCaptured' | 'timeExpired' | 'teamEliminated';
  endTick: number;
}

export interface World {
  tick: number;
  rng: Rng;
  map: Tilemap;
  units: UnitState[];
  commanders: Commander[];
  pocs: PoC[];
  projectiles: Projectile[];
  spawnZones: SpawnZone[];
  /** Events emitted during the current tick; drained by the renderer/tests. */
  events: SimEvent[];
  grid: SpatialGrid;
  durationTicks: number;
  reinforceCutoffTick: number;
  result: BattleResult | null;
  nextProjectileId: number;
}

export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Air units live in the air domain; ground and hover share the ground domain. */
export function domainOf(unit: UnitState): 'ground' | 'air' {
  return unit.stats.locomotion === 'air' ? 'air' : 'ground';
}
