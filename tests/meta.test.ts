import { describe, expect, it } from 'vitest';
import { buildCampaignBattleConfig } from '../src/game/setup';
import {
  PROVINCES,
  advanceTurn,
  attackTargets,
  campaignResult,
  delegateHoldChance,
  newCampaign,
  resolveDefense,
  resolvePlayerAttack,
  turnIncome,
} from '../src/meta/campaign';
import { applyOutcome, summarizeBattle } from '../src/meta/outcome';
import {
  createMemoryStore,
  defaultProfile,
  deleteSquadGroup,
  groupValidUids,
  profileRank,
  upsertSquadGroup,
} from '../src/meta/profile';
import {
  chassisGate,
  cpBudget,
  cpCost,
  fieldCap,
  maxWeightMult,
  techGate,
} from '../src/meta/rules';
import { battleXp, heroRank, unitLevel, unitXpForLevel } from '../src/meta/xp';
import { ATTACKER } from '../src/sim/types';
import { createBattle } from '../src/sim/world';
import { db } from './helpers';

describe('hero rules', () => {
  const attrs = { tactics: 20, education: 16, clout: 20, mech: 10 };

  it('derives caps and budgets from attributes', () => {
    expect(fieldCap(attrs)).toBe(10);
    expect(cpBudget(attrs)).toBe(100);
    expect(techGate(1, attrs)).toBe(9);
    expect(techGate(5, attrs)).toBe(13);
    expect(chassisGate(4, attrs)).toBe(10); // all starter chassis available
    expect(maxWeightMult(attrs)).toBeCloseTo(1.1);
  });

  it('caps field size at 12 like SG', () => {
    expect(fieldCap({ ...attrs, clout: 90 })).toBe(12);
  });
});

describe('xp curves', () => {
  it('unit levels follow the cumulative curve', () => {
    expect(unitLevel(0)).toBe(1);
    expect(unitLevel(99)).toBe(1);
    expect(unitLevel(100)).toBe(2);
    expect(unitLevel(300)).toBe(3);
    expect(unitLevel(unitXpForLevel(7))).toBe(7);
  });

  it('hero ranks follow the quadratic curve', () => {
    expect(heroRank(6400)).toBe(4);
    expect(heroRank(9999)).toBe(4);
    expect(heroRank(10000)).toBe(5);
  });

  it('battle xp rewards damage, kills, survival and victory', () => {
    expect(battleXp({ damageDealt: 5000, kills: 3, survived: true, won: true })).toBe(185);
    expect(battleXp({ damageDealt: 0, kills: 0, survived: false, won: false })).toBe(10);
    expect(battleXp({ damageDealt: 5000, kills: 3, survived: true, won: true }, 1.2)).toBe(222);
  });
});

describe('profile', () => {
  it('builds a default profile with the starter army', () => {
    const profile = defaultProfile(db);
    expect(profile.units.length).toBe(22);
    expect(profileRank(profile)).toBe(4);
    expect(profile.lastSquad.length).toBe(10);
  });

  it('round-trips through a store', () => {
    const store = createMemoryStore();
    const profile = defaultProfile(db);
    profile.credits = 1234;
    store.save(profile);
    expect(store.load()?.credits).toBe(1234);
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('saves, overwrites, and prunes squad groups', () => {
    const profile = defaultProfile(db);
    const a = profile.units[0]!.uid;
    const b = profile.units[1]!.uid;
    upsertSquadGroup(profile, 'Vanguard', [a, b]);
    expect(profile.squadGroups).toHaveLength(1);
    expect(profile.squadGroups[0]).toEqual({ name: 'Vanguard', uids: [a, b] });

    // Same name overwrites rather than duplicating.
    upsertSquadGroup(profile, 'Vanguard', [b]);
    expect(profile.squadGroups).toHaveLength(1);
    expect(profile.squadGroups[0]!.uids).toEqual([b]);

    // Empty names are ignored.
    upsertSquadGroup(profile, '   ', [a]);
    expect(profile.squadGroups).toHaveLength(1);

    deleteSquadGroup(profile, 'Vanguard');
    expect(profile.squadGroups).toHaveLength(0);
  });

  it('filters group uids to units still owned', () => {
    const profile = defaultProfile(db);
    const a = profile.units[0]!.uid;
    const group = { name: 'X', uids: [a, 'scrapped-uid', profile.units[1]!.uid] };
    expect(groupValidUids(group, profile)).toEqual([a, profile.units[1]!.uid]);
  });

  it('defaults squadGroups for legacy saves without the field', () => {
    const store = createMemoryStore();
    const profile = defaultProfile(db);
    // Simulate an older save by stripping the field before persisting.
    const legacy = JSON.parse(JSON.stringify(profile)) as Record<string, unknown>;
    legacy.squadGroups = undefined;
    store.save(legacy as unknown as typeof profile);
    expect(store.load()?.squadGroups).toEqual([]);
  });
});

describe('battle outcome', () => {
  it('summarizes player performance and applies xp/credits/rank-ups', () => {
    const profile = defaultProfile(db);
    const config = buildCampaignBattleConfig(
      {
        side: ATTACKER,
        enemyFaction: 'enemy',
        enemyCommanders: 1,
        allyCommanders: 0,
        seed: 9,
        squadUids: profile.lastSquad,
        reserveUids: [],
        targetProvinceId: 'crossroads',
        fromProvinceId: 'verdant',
      },
      profile,
      db,
    );
    const world = createBattle(config);
    // Fake a battle: unit 0 fought hard and died, unit 1 got two kills.
    world.units[0]!.damageDealt = 4000;
    world.units[0]!.alive = false;
    world.units[1]!.damageDealt = 2500;
    world.units[1]!.kills = 2;

    const summary = summarizeBattle(world, 0, profile, { won: true, xpMult: 1 });
    expect(summary.unitOutcomes.length).toBe(10);
    const dead = summary.unitOutcomes.find((o) => !o.survived)!;
    expect(dead.xpGained).toBe(100); // 4000*0.02 + 0 + 0 + 20
    expect(summary.repairCost).toBeGreaterThan(0);
    expect(summary.creditsEarned).toBe(150 + 150 + 20);

    const before = profile.credits;
    const applied = applyOutcome(profile, summary);
    expect(profile.units.find((u) => u.uid === dead.uid)?.xp).toBe(100);
    expect(profile.credits).toBe(Math.max(0, before + summary.creditsEarned - summary.repairCost));
    expect(applied.newRank).toBeGreaterThanOrEqual(4);
  });

  it('owned units bake veterancy health bonuses', () => {
    const profile = defaultProfile(db);
    const veteran = profile.units[0]!;
    veteran.xp = unitXpForLevel(6); // level 6 = +10% health
    const config = buildCampaignBattleConfig(
      {
        side: ATTACKER,
        enemyFaction: 'enemy',
        enemyCommanders: 1,
        allyCommanders: 0,
        seed: 9,
        squadUids: [veteran.uid],
        reserveUids: [],
        targetProvinceId: 'crossroads',
        fromProvinceId: 'verdant',
      },
      profile,
      db,
    );
    const world = createBattle(config);
    expect(world.units[0]!.stats.maxHealth).toBe(Math.round(1650 * 1.1));
  });
});

describe('campaign', () => {
  it('starts with the canonical map and finds attack targets', () => {
    const state = newCampaign(7);
    expect(PROVINCES.length).toBe(12);
    expect(campaignResult(state)).toBeNull();
    const targets = attackTargets(state).map((p) => p.id);
    expect(targets).toContain('crossroads');
    expect(targets).toContain('broodfen');
    expect(targets).not.toContain('keep'); // not adjacent to player land yet
  });

  it('flips provinces on battle outcomes and detects victory/defeat', () => {
    const state = newCampaign(7);
    resolvePlayerAttack(state, 'crossroads', true);
    expect(state.owners.crossroads).toBe('player');
    state.pendingAttack = { provinceId: 'bastion', strength: 4, fromProvinceId: 'verdant' };
    resolveDefense(state, false);
    expect(campaignResult(state)).toBe('defeat');

    const winState = newCampaign(7);
    winState.owners.keep = 'player';
    expect(campaignResult(winState)).toBe('victory');
  });

  it('enemy turns are deterministic per seed and can mass attacks', () => {
    const a = newCampaign(42);
    const b = newCampaign(42);
    for (let i = 0; i < 10; i++) {
      advanceTurn(a);
      advanceTurn(b);
    }
    expect(a.pendingAttack).toEqual(b.pendingAttack);
    expect(a.turn).toBe(11);
  });

  it('income and delegate odds are sane', () => {
    const state = newCampaign(7);
    expect(turnIncome(state)).toBe(50 + 50 + 80 + 30); // verdant + terrace + bastion + hq bonus
    state.pendingAttack = { provinceId: 'bastion', strength: 5, fromProvinceId: 'verdant' };
    const odds = delegateHoldChance(state);
    expect(odds).toBeGreaterThan(0.1);
    expect(odds).toBeLessThan(0.9);
  });
});
