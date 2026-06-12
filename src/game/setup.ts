import type { ContentDB } from '../content/db';
import { buildAshfallCrossing } from '../sim/map/maps';
import { ATTACKER, DEFENDER, type Team } from '../sim/types';
import type { BattleConfig, CommanderSetup } from '../sim/world';

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

export const PLAYER_SQUAD: { squad: string[]; reserves: string[] } = {
  squad: [
    'd_mote',
    'd_mote',
    'd_mote',
    'd_bulwark',
    'd_bulwark',
    'd_stinger',
    'd_mender',
    'd_dustdevil',
    'd_mastodon',
    'd_longarm',
  ],
  reserves: [
    'd_mote',
    'd_mote',
    'd_bulwark',
    'd_dustdevil',
    'd_stinger',
    'd_mote',
    'd_mastodon',
    'd_mote',
    'd_bulwark',
    'd_mote',
    'd_longarm',
    'd_mote',
  ],
};

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
