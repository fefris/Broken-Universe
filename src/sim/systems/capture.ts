import { CAPTURE_DECAY_MULT } from '../constants';
import { ATTACKER, dist, type World } from '../types';

const scratchIds: number[] = [];

/**
 * Capture rate by attacker headcount: 1 unit = base rate, each extra
 * adds half, capped at 3x. A 60s PoC falls in 20s to five attackers.
 */
export function captureRate(attackerCount: number): number {
  if (attackerCount <= 0) return 0;
  return Math.min(1 + (attackerCount - 1) * 0.5, 3);
}

export function captureSystem(world: World): void {
  for (const poc of world.pocs) {
    if (poc.owner === ATTACKER) continue; // captured PoCs stay captured

    let attackers = 0;
    let defenders = 0;
    world.grid.queryCircle(poc.pos, poc.radius, scratchIds);
    for (const id of scratchIds) {
      const unit = world.units[id];
      if (!unit?.alive) continue;
      if (dist(unit.pos, poc.pos) > poc.radius) continue;
      if (unit.team === ATTACKER) attackers++;
      else defenders++;
    }

    if (attackers > 0 && defenders === 0) {
      poc.progress += captureRate(attackers);
      if (poc.progress >= poc.captureTicks) {
        poc.owner = ATTACKER;
        poc.progress = 0;
        world.events.push({ type: 'pocCaptured', pocId: poc.id, newOwner: ATTACKER });
      }
    } else if (attackers === 0 && poc.progress > 0) {
      poc.progress = Math.max(0, poc.progress - CAPTURE_DECAY_MULT);
    }
    // Both present: contested, progress frozen.
  }
}
