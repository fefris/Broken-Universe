/** Simulation runs at a fixed 20 Hz; all sim time is integer ticks. */
export const TICK_MS = 50;
export const TICKS_PER_SECOND = 1000 / TICK_MS;

/** 15-minute battle. */
export const BATTLE_DURATION_TICKS = 15 * 60 * TICKS_PER_SECOND;
/** No reserve deployments during the final 3 minutes (Shattered Galaxy rule). */
export const REINFORCE_CUTOFF_TICKS = BATTLE_DURATION_TICKS - 3 * 60 * TICKS_PER_SECOND;

/** Sim distances are meters (SG-native stats); the renderer converts. */
export const PIXELS_PER_METER = 8;

/** Tile size in meters. */
export const TILE_SIZE = 4;

/** Spatial hash cell size in meters. */
export const SPATIAL_CELL_SIZE = 16;

/** Targeting/micro re-evaluation cadence in ticks, staggered per unit. */
export const TARGETING_INTERVAL = 5;

/** Engine strain penalties (power < total weight). */
export const STRAIN_SPEED_MULT = 0.75;
export const STRAIN_DRAIN_MULT = 1.5;

/** Damage floor: at least 5% of base damage (min 1) always goes through. */
export const DAMAGE_FLOOR_FRACTION = 0.05;

/** Capture progress accrues per attacker in the zone, capped at this many. */
export const CAPTURE_COUNT_CAP = 5;
/** Idle capture progress decays at this multiple of accrual rate. */
export const CAPTURE_DECAY_MULT = 2;

export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * TICKS_PER_SECOND);
}

export function ticksToSeconds(ticks: number): number {
  return ticks / TICKS_PER_SECOND;
}
