export type DifficultyLevel = 'easy' | 'normal' | 'hard';

export interface DifficultyProfile {
  /** Ticks between intent re-evaluations. */
  decisionIntervalTicks: number;
  /** Utility scores are multiplied by 1 ± noise, so weaker AIs pick worse objectives. */
  scoreNoise: number;
  /** Cooldown kiting for ranged units. */
  kitingEnabled: boolean;
  focusFireEnabled: boolean;
  /** Chance per decision to skip an available reserve deployment. */
  deploySkipChance: number;
}

export const DIFFICULTIES: Record<DifficultyLevel, DifficultyProfile> = {
  easy: {
    decisionIntervalTicks: 100,
    scoreNoise: 0.3,
    kitingEnabled: false,
    focusFireEnabled: false,
    deploySkipChance: 0.5,
  },
  normal: {
    decisionIntervalTicks: 40,
    scoreNoise: 0.12,
    kitingEnabled: false,
    focusFireEnabled: true,
    deploySkipChance: 0.15,
  },
  hard: {
    decisionIntervalTicks: 40,
    scoreNoise: 0.03,
    kitingEnabled: true,
    focusFireEnabled: true,
    deploySkipChance: 0,
  },
};
