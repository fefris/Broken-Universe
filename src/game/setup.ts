import type { ContentDB } from '../content/db';
import type { ResolvedUnit } from '../content/schema';
import { type Profile, ownedToDesign } from '../meta/profile';
import { fieldCap, healthMult } from '../meta/rules';
import { PLAYER_SQUAD } from '../meta/starterArmy';
import { unitLevel } from '../meta/xp';
import { buildAshfallCrossing } from '../sim/map/maps';
import { ATTACKER, DEFENDER, type Team, otherTeam } from '../sim/types';
import { resolveUnit } from '../sim/unitStats';
import type { BattleConfig, CommanderSetup } from '../sim/world';

export { PLAYER_SQUAD };

export interface BattleOptions {
  seed: number;
  /** AI commanders per side (the player joins the attacker count if playing). */
  attackerCommanders: number;
  defenderCommanders: number;
  /** null = spectate an all-AI battle. */
  playerTeam: Team | null;
}

/** Squad archetypes cycled across AI commanders for varied team composition. */
const SQUAD_PRESETS: { name: string; squad: string[]; reserves: string[] }[] = [
  {
    name: 'Assault',
    squad: [
      'd_mote',
      'd_mote',
      'd_mote',
      'd_mote',
      'd_bulwark',
      'd_bulwark',
      'd_mender',
      'd_dustdevil',
      'd_dustdevil',
      'd_mastodon',
    ],
    reserves: [
      'd_mote',
      'd_mote',
      'd_bulwark',
      'd_mote',
      'd_dustdevil',
      'd_mote',
      'd_bulwark',
      'd_mote',
    ],
  },
  {
    name: 'Siege',
    squad: [
      'd_mote',
      'd_mote',
      'd_mote',
      'd_longarm',
      'd_longarm',
      'd_skyspike',
      'd_bulwark',
      'd_bulwark',
      'd_mender',
      'd_mastodon',
    ],
    reserves: [
      'd_longarm',
      'd_mote',
      'd_bulwark',
      'd_mote',
      'd_skyspike',
      'd_mote',
      'd_mote',
      'd_longarm',
    ],
  },
  {
    name: 'Air Wing',
    squad: [
      'd_mistral',
      'd_mistral',
      'd_mistral',
      'd_mistral',
      'd_monsoon',
      'd_monsoon',
      'd_monsoon',
      'd_courier',
      'd_courier',
      'd_skyspike',
    ],
    reserves: [
      'd_mistral',
      'd_monsoon',
      'd_mistral',
      'd_monsoon',
      'd_mistral',
      'd_mistral',
      'd_monsoon',
      'd_mistral',
    ],
  },
  {
    name: 'Swarm',
    squad: [
      'd_hatchling',
      'd_hatchling',
      'd_hatchling',
      'd_hatchling',
      'd_hatchling',
      'd_hatchling',
      'd_mote',
      'd_mote',
      'd_mote',
      'd_mender',
    ],
    reserves: [
      'd_hatchling',
      'd_hatchling',
      'd_hatchling',
      'd_hatchling',
      'd_hatchling',
      'd_hatchling',
      'd_hatchling',
      'd_hatchling',
    ],
  },
  {
    name: 'Recon',
    squad: [
      'd_courier',
      'd_courier',
      'd_courier',
      'd_courier',
      'd_dustdevil',
      'd_dustdevil',
      'd_dustdevil',
      'd_stinger',
      'd_stinger',
      'd_mender',
    ],
    reserves: [
      'd_courier',
      'd_dustdevil',
      'd_courier',
      'd_stinger',
      'd_dustdevil',
      'd_courier',
      'd_courier',
      'd_dustdevil',
    ],
  },
];

export function buildBattleConfig(options: BattleOptions, db: ContentDB): BattleConfig {
  const commanders: CommanderSetup[] = [];

  if (options.playerTeam !== null) {
    commanders.push({
      team: options.playerTeam,
      name: 'You',
      isPlayer: true,
      squadDesignIds: PLAYER_SQUAD.squad,
      reserveDesignIds: PLAYER_SQUAD.reserves,
      squadCap: 10,
    });
  }

  const addAi = (team: Team, count: number, label: string) => {
    for (let i = 0; i < count; i++) {
      const preset = SQUAD_PRESETS[(i + (team === DEFENDER ? 2 : 0)) % SQUAD_PRESETS.length]!;
      commanders.push({
        team,
        name: `${label} ${preset.name} ${i + 1}`,
        squadDesignIds: preset.squad,
        reserveDesignIds: preset.reserves,
        squadCap: 10,
      });
    }
  };
  addAi(ATTACKER, options.attackerCommanders, 'Strike');
  addAi(DEFENDER, options.defenderCommanders, 'Guard');

  return {
    seed: options.seed,
    mapDef: buildAshfallCrossing(),
    commanders,
    resolve: (designId) => db.resolved(designId),
  };
}

/** Hatchling-swarm presets for Broodmind provinces. */
const BROOD_PRESETS: { name: string; squad: string[]; reserves: string[] }[] = [
  {
    name: 'Spawn Cluster',
    squad: Array.from({ length: 7 }, () => 'd_hatchling').concat([
      'd_broodling',
      'd_broodling',
      'd_broodling',
    ]),
    reserves: Array.from({ length: 8 }, () => 'd_hatchling'),
  },
  {
    name: 'Elder Brood',
    squad: Array.from({ length: 4 }, () => 'd_hatchling').concat(
      Array.from({ length: 6 }, () => 'd_broodling'),
    ),
    reserves: Array.from({ length: 4 }, () => 'd_broodling').concat(
      Array.from({ length: 4 }, () => 'd_hatchling'),
    ),
  },
];

export interface CampaignBattleContext {
  /** Which side the player fights on this battle. */
  side: Team;
  enemyFaction: 'enemy' | 'brood';
  enemyCommanders: number;
  allyCommanders: number;
  seed: number;
  /** Owned-unit uids: fielded squad and reserve pool. */
  squadUids: string[];
  reserveUids: string[];
}

/**
 * Battle config for a campaign engagement: the player's owned units (with
 * veterancy health bonuses baked in) plus AI allies vs the province force.
 */
export function buildCampaignBattleConfig(
  ctx: CampaignBattleContext,
  profile: Profile,
  db: ContentDB,
): BattleConfig {
  const ownedStats = new Map<string, ResolvedUnit>();
  for (const unit of profile.units) {
    ownedStats.set(
      unit.uid,
      resolveUnit(ownedToDesign(unit), db, { healthMult: healthMult(unitLevel(unit.xp)) }),
    );
  }

  const commanders: CommanderSetup[] = [
    {
      team: ctx.side,
      name: profile.heroName,
      isPlayer: true,
      squadDesignIds: ctx.squadUids,
      reserveDesignIds: ctx.reserveUids,
      squadCap: fieldCap(profile.attributes),
    },
  ];

  for (let i = 0; i < ctx.allyCommanders; i++) {
    const preset = SQUAD_PRESETS[i % SQUAD_PRESETS.length]!;
    commanders.push({
      team: ctx.side,
      name: `Concord ${preset.name} ${i + 1}`,
      squadDesignIds: preset.squad,
      reserveDesignIds: preset.reserves,
      squadCap: 10,
    });
  }

  const enemyTeam = otherTeam(ctx.side);
  for (let i = 0; i < ctx.enemyCommanders; i++) {
    if (ctx.enemyFaction === 'brood') {
      const preset = BROOD_PRESETS[i % BROOD_PRESETS.length]!;
      commanders.push({
        team: enemyTeam,
        name: `Brood ${preset.name} ${i + 1}`,
        squadDesignIds: preset.squad,
        reserveDesignIds: preset.reserves,
        squadCap: 10,
      });
    } else {
      const preset = SQUAD_PRESETS[(i + 2) % SQUAD_PRESETS.length]!;
      commanders.push({
        team: enemyTeam,
        name: `Dominion ${preset.name} ${i + 1}`,
        squadDesignIds: preset.squad,
        reserveDesignIds: preset.reserves,
        squadCap: 10,
      });
    }
  }

  return {
    seed: ctx.seed,
    mapDef: buildAshfallCrossing(),
    commanders,
    resolve: (designId) => ownedStats.get(designId) ?? db.resolved(designId),
  };
}
