import { ATTACKER, type Team } from '../sim/types';

export const TEAM_COLORS: Record<Team, number> = {
  [0]: 0x3d9bff, // attacker blue
  [1]: 0xff5252, // defender red
};

/** Brighter variant marking the player's own squad. */
export const PLAYER_COLORS: Record<Team, number> = {
  [0]: 0x8fe3ff,
  [1]: 0xffb86b,
};

export function teamColor(team: Team, isPlayerUnit: boolean): number {
  return isPlayerUnit ? PLAYER_COLORS[team] : TEAM_COLORS[team];
}

export const COLOR_BG = 0x12161c;
export const COLOR_OPEN = 0x1b222b;
export const COLOR_SLOW = 0x232b22;
export const COLOR_BLOCKED = 0x3a4250;
export const COLOR_TRACER = 0xffe9a3;

export function hpColor(ratio: number): number {
  if (ratio > 0.6) return 0x6fe06f;
  if (ratio > 0.3) return 0xe0c050;
  return 0xe05050;
}

export const ATTACKER_TEAM = ATTACKER;
