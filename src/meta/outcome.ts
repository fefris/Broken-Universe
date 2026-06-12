import type { World } from '../sim/types';
import type { Profile } from './profile';
import { REPAIR_COST_FRACTION } from './rules';
import { POINTS_PER_RANK, battleXp, heroRank, unitLevel } from './xp';

export interface UnitOutcome {
  uid: string;
  name: string;
  damageDealt: number;
  kills: number;
  survived: boolean;
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
}

export interface BattleSummary {
  won: boolean;
  unitOutcomes: UnitOutcome[];
  creditsEarned: number;
  repairCost: number;
  heroXpGained: number;
}

/**
 * Collect the player commander's battle performance. Owned units carry their
 * uid as ResolvedUnit.designId, so sim units map straight back to the roster.
 */
export function summarizeBattle(
  world: World,
  playerCommanderId: number,
  profile: Profile,
  opts: { won: boolean; xpMult: number },
): BattleSummary {
  const commander = world.commanders[playerCommanderId];
  const outcomes: UnitOutcome[] = [];
  let kills = 0;
  let repairCost = 0;

  for (const unitId of commander?.squad ?? []) {
    const unit = world.units[unitId];
    if (!unit) continue;
    const uid = unit.stats.designId;
    const owned = profile.units.find((u) => u.uid === uid);
    if (!owned) continue;
    const xpGained = battleXp(
      {
        damageDealt: unit.damageDealt,
        kills: unit.kills,
        survived: unit.alive,
        won: opts.won,
      },
      opts.xpMult,
    );
    kills += unit.kills;
    if (!unit.alive) repairCost += Math.round(unit.stats.cost * REPAIR_COST_FRACTION);
    const levelBefore = unitLevel(owned.xp);
    outcomes.push({
      uid,
      name: owned.name,
      damageDealt: Math.round(unit.damageDealt),
      kills: unit.kills,
      survived: unit.alive,
      xpGained,
      levelBefore,
      levelAfter: unitLevel(owned.xp + xpGained),
    });
  }

  return {
    won: opts.won,
    unitOutcomes: outcomes,
    creditsEarned: 150 + (opts.won ? 150 : 50) + kills * 10,
    repairCost,
    heroXpGained: outcomes.reduce((sum, o) => sum + o.xpGained, 0),
  };
}

export interface AppliedOutcome {
  ranksGained: number;
  newRank: number;
}

/** Mutate the profile with a battle's results. Pure of any storage concern. */
export function applyOutcome(profile: Profile, summary: BattleSummary): AppliedOutcome {
  for (const outcome of summary.unitOutcomes) {
    const owned = profile.units.find((u) => u.uid === outcome.uid);
    if (owned) owned.xp += outcome.xpGained;
  }
  profile.heroXp += summary.heroXpGained;
  profile.credits = Math.max(0, profile.credits + summary.creditsEarned - summary.repairCost);

  const newRank = heroRank(profile.heroXp);
  let ranksGained = 0;
  while (profile.pointsGrantedAtRank < newRank) {
    profile.pointsGrantedAtRank++;
    profile.attrPoints += POINTS_PER_RANK;
    ranksGained++;
  }
  return { ranksGained, newRank };
}
