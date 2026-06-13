import { CAPTURE_DECAY_MULT } from '../constants';
import { type World, dist, otherTeam } from '../types';

const scratchIds: number[] = [];

/**
 * Capture progress per tick scales with the capturing headcount: 1 unit = base
 * rate, each extra adds half, capped at 3x. A 60s PoC falls in 20s to five.
 */
export function captureRate(count: number): number {
  if (count <= 0) return 0;
  return Math.min(1 + (count - 1) * 0.5, 3);
}

/**
 * PoCs are contested by both sides and flip back and forth (faithful to SG):
 * whichever team does NOT own a point can take it by standing in the zone
 * uncontested, so a defender can recapture ground an attacker overran.
 * `progress` always counts toward the current non-owner (the challenger).
 */
export function captureSystem(world: World): void {
  for (const poc of world.pocs) {
    let team0 = 0;
    let team1 = 0;
    world.grid.queryCircle(poc.pos, poc.radius, scratchIds);
    for (const id of scratchIds) {
      const unit = world.units[id];
      if (!unit?.alive) continue;
      if (dist(unit.pos, poc.pos) > poc.radius) continue;
      if (unit.team === 0) team0++;
      else team1++;
    }

    const challenger = otherTeam(poc.owner);
    const ownerCount = poc.owner === 0 ? team0 : team1;
    const challengerCount = challenger === 0 ? team0 : team1;

    if (challengerCount > 0 && ownerCount === 0) {
      poc.progress += captureRate(challengerCount);
      if (poc.progress >= poc.captureTicks) {
        poc.owner = challenger;
        poc.progress = 0;
        world.events.push({ type: 'pocCaptured', pocId: poc.id, newOwner: challenger });
      }
    } else if (poc.progress > 0 && !(team0 > 0 && team1 > 0)) {
      // Not contested and nobody is capturing: decay back toward the owner.
      poc.progress = Math.max(0, poc.progress - CAPTURE_DECAY_MULT);
    }
    // Both teams present: contested, progress frozen.
  }
}
