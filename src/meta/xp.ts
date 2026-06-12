/** Cumulative XP required to reach a given unit level (level 1 = 0). */
export function unitXpForLevel(level: number): number {
  return (100 * (level - 1) * level) / 2;
}

export function unitLevel(xp: number): number {
  let level = 1;
  while (unitXpForLevel(level + 1) <= xp) level++;
  return level;
}

export interface BattlePerformance {
  damageDealt: number;
  kills: number;
  survived: boolean;
  won: boolean;
}

/** XP a unit earns from one battle. */
export function battleXp(perf: BattlePerformance, xpMult = 1): number {
  const base =
    perf.damageDealt * 0.02 + perf.kills * 15 + (perf.survived ? 20 : 0) + (perf.won ? 20 : 10);
  return Math.round(base * xpMult);
}

/** Cumulative hero XP required for a rank. */
export function heroXpForRank(rank: number): number {
  return 400 * rank * rank;
}

export function heroRank(xp: number): number {
  let rank = 0;
  while (heroXpForRank(rank + 1) <= xp) rank++;
  return rank;
}

/** Attribute points granted per rank gained. */
export const POINTS_PER_RANK = 3;
