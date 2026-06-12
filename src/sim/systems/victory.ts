import { ATTACKER, DEFENDER, type Team, type World } from '../types';

function teamHasForces(world: World, team: Team): boolean {
  for (const unit of world.units) {
    if (unit.alive && unit.team === team) return true;
  }
  for (const commander of world.commanders) {
    if (commander.team === team && commander.reserves.length > 0) return true;
  }
  return false;
}

export function victorySystem(world: World): void {
  if (world.result) return;

  const end = (winner: Team, reason: NonNullable<World['result']>['reason']) => {
    world.result = { winner, reason, endTick: world.tick };
    world.events.push({ type: 'battleEnded', winner });
  };

  if (world.pocs.every((p) => p.owner === ATTACKER)) {
    end(ATTACKER, 'allPocsCaptured');
    return;
  }
  if (world.tick >= world.durationTicks) {
    end(DEFENDER, 'timeExpired');
    return;
  }
  // Elimination: defenders hold by default, so a wiped attacker team loses.
  if (!teamHasForces(world, ATTACKER)) {
    end(DEFENDER, 'teamEliminated');
    return;
  }
  if (!teamHasForces(world, DEFENDER)) {
    end(ATTACKER, 'teamEliminated');
  }
}
