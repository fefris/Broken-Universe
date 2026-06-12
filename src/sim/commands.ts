import type { Vec2 } from './types';

/**
 * All input — player and AI alike — enters the sim as commands applied at
 * the start of a tick. Same seed + same command stream = identical battle.
 */
export type Command =
  | { type: 'move'; commanderId: number; unitIds: number[]; goal: Vec2 }
  | { type: 'attackMove'; commanderId: number; unitIds: number[]; goal: Vec2 }
  | { type: 'attackTarget'; commanderId: number; unitIds: number[]; targetId: number }
  | { type: 'stop'; commanderId: number; unitIds: number[] }
  | { type: 'setFocusTarget'; commanderId: number; targetId: number }
  | { type: 'deploy'; commanderId: number; designId: string };
