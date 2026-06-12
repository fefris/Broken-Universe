import type { Team, Vec2 } from './types';

export type SimEvent =
  | { type: 'weaponFired'; unitId: number; targetId: number; from: Vec2; to: Vec2; hitscan: boolean }
  | { type: 'projectileDetonated'; pos: Vec2; splashRadius: number }
  | { type: 'unitDamaged'; unitId: number; amount: number }
  | { type: 'unitHealed'; unitId: number; amount: number }
  | { type: 'unitDied'; unitId: number; pos: Vec2 }
  | { type: 'unitDeployed'; unitId: number; commanderId: number }
  | { type: 'pocCaptured'; pocId: number; newOwner: Team }
  | { type: 'battleEnded'; winner: Team };
