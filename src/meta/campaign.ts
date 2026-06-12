import { createRng, deriveSeed } from '../sim/rng';

export type Faction = 'player' | 'enemy' | 'brood';
export type ProvinceBonus = 'hq' | 'factory' | 'simulator' | null;

export interface ProvinceDef {
  id: string;
  name: string;
  /** Layout position in percent of the map view. */
  x: number;
  y: number;
  adj: string[];
  initialOwner: Faction;
  income: number;
  bonus: ProvinceBonus;
  /** Enemy AI commanders defending (and attacking from) this province. */
  garrison: number;
}

/**
 * Planet Calderis: the Aurora Concord (player) holds the south, the Vesper
 * Dominion the north, with a Broodmind infestation rotting the flanks.
 * Capture Vesper Keep to win; lose Aurora Bastion and the campaign falls.
 */
export const PROVINCES: ProvinceDef[] = [
  {
    id: 'keep',
    name: 'Vesper Keep',
    x: 50,
    y: 8,
    adj: ['rampart', 'foundry'],
    initialOwner: 'enemy',
    income: 80,
    bonus: 'hq',
    garrison: 5,
  },
  {
    id: 'rampart',
    name: 'The Rampart',
    x: 30,
    y: 22,
    adj: ['keep', 'ashfield', 'mirrorlake'],
    initialOwner: 'enemy',
    income: 50,
    bonus: null,
    garrison: 4,
  },
  {
    id: 'foundry',
    name: 'Dominion Foundry',
    x: 70,
    y: 22,
    adj: ['keep', 'glasswaste', 'mirrorlake'],
    initialOwner: 'enemy',
    income: 60,
    bonus: 'factory',
    garrison: 4,
  },
  {
    id: 'ashfield',
    name: 'Ashfield',
    x: 14,
    y: 42,
    adj: ['rampart', 'broodfen', 'crossroads'],
    initialOwner: 'enemy',
    income: 40,
    bonus: null,
    garrison: 3,
  },
  {
    id: 'mirrorlake',
    name: 'Mirrorlake',
    x: 50,
    y: 36,
    adj: ['rampart', 'foundry', 'crossroads'],
    initialOwner: 'enemy',
    income: 50,
    bonus: 'simulator',
    garrison: 4,
  },
  {
    id: 'glasswaste',
    name: 'Glasswaste',
    x: 86,
    y: 42,
    adj: ['foundry', 'hivemaw', 'crossroads'],
    initialOwner: 'enemy',
    income: 40,
    bonus: null,
    garrison: 3,
  },
  {
    id: 'broodfen',
    name: 'Broodfen',
    x: 14,
    y: 66,
    adj: ['ashfield', 'verdant'],
    initialOwner: 'brood',
    income: 45,
    bonus: null,
    garrison: 4,
  },
  {
    id: 'crossroads',
    name: 'Calderis Crossroads',
    x: 50,
    y: 58,
    adj: ['ashfield', 'mirrorlake', 'glasswaste', 'verdant', 'terrace'],
    initialOwner: 'enemy',
    income: 70,
    bonus: null,
    garrison: 4,
  },
  {
    id: 'hivemaw',
    name: 'Hivemaw',
    x: 86,
    y: 66,
    adj: ['glasswaste', 'terrace'],
    initialOwner: 'brood',
    income: 45,
    bonus: null,
    garrison: 4,
  },
  {
    id: 'verdant',
    name: 'Verdant Steps',
    x: 32,
    y: 80,
    adj: ['broodfen', 'crossroads', 'bastion'],
    initialOwner: 'player',
    income: 50,
    bonus: 'simulator',
    garrison: 3,
  },
  {
    id: 'terrace',
    name: 'Sunward Terrace',
    x: 68,
    y: 80,
    adj: ['hivemaw', 'crossroads', 'bastion'],
    initialOwner: 'player',
    income: 50,
    bonus: 'factory',
    garrison: 3,
  },
  {
    id: 'bastion',
    name: 'Aurora Bastion',
    x: 50,
    y: 92,
    adj: ['verdant', 'terrace'],
    initialOwner: 'player',
    income: 80,
    bonus: 'hq',
    garrison: 4,
  },
];

export const HOME_PROVINCE = 'bastion';
export const ENEMY_KEEP = 'keep';

export interface PendingAttack {
  provinceId: string;
  /** Attacking commander count. */
  strength: number;
}

export interface CampaignState {
  seed: number;
  turn: number;
  owners: Record<string, Faction>;
  pendingAttack: PendingAttack | null;
  log: string[];
}

export function provinceDef(id: string): ProvinceDef {
  const def = PROVINCES.find((p) => p.id === id);
  if (!def) throw new Error(`unknown province '${id}'`);
  return def;
}

export function newCampaign(seed: number): CampaignState {
  const owners: Record<string, Faction> = {};
  for (const p of PROVINCES) owners[p.id] = p.initialOwner;
  return { seed, turn: 1, owners, pendingAttack: null, log: ['The war for Calderis begins.'] };
}

export function ownedBy(state: CampaignState, faction: Faction): ProvinceDef[] {
  return PROVINCES.filter((p) => state.owners[p.id] === faction);
}

/** Provinces the player can assault: hostile and adjacent to player land. */
export function attackTargets(state: CampaignState): ProvinceDef[] {
  return PROVINCES.filter((p) => {
    if (state.owners[p.id] === 'player') return false;
    return p.adj.some((a) => state.owners[a] === 'player');
  });
}

/** Credits collected when a turn ends. */
export function turnIncome(state: CampaignState): number {
  let total = 0;
  for (const p of ownedBy(state, 'player')) {
    total += p.income + (p.bonus === 'hq' ? 30 : 0);
  }
  return total;
}

export function hasBonus(state: CampaignState, bonus: ProvinceBonus): boolean {
  return ownedBy(state, 'player').some((p) => p.bonus === bonus);
}

/** XP multiplier from simulator provinces. */
export function xpMult(state: CampaignState): number {
  return hasBonus(state, 'simulator') ? 1.2 : 1;
}

/** Garage price multiplier from factory provinces. */
export function priceMult(state: CampaignState): number {
  return hasBonus(state, 'factory') ? 0.85 : 1;
}

export function campaignResult(state: CampaignState): 'victory' | 'defeat' | null {
  if (state.owners[ENEMY_KEEP] === 'player') return 'victory';
  if (state.owners[HOME_PROVINCE] !== 'player') return 'defeat';
  return null;
}

function log(state: CampaignState, message: string): void {
  state.log.push(message);
  if (state.log.length > 30) state.log.shift();
}

/** Apply the outcome of the player's assault on a province. */
export function resolvePlayerAttack(state: CampaignState, provinceId: string, won: boolean): void {
  const def = provinceDef(provinceId);
  if (won) {
    state.owners[provinceId] = 'player';
    log(state, `Turn ${state.turn}: ${def.name} captured.`);
  } else {
    log(state, `Turn ${state.turn}: assault on ${def.name} repelled.`);
  }
}

/** Apply the outcome of defending against a pending enemy attack. */
export function resolveDefense(state: CampaignState, won: boolean): void {
  const pending = state.pendingAttack;
  if (!pending) return;
  const def = provinceDef(pending.provinceId);
  if (won) {
    log(state, `Turn ${state.turn}: ${def.name} held against the Dominion.`);
  } else {
    state.owners[pending.provinceId] = 'enemy';
    log(state, `Turn ${state.turn}: ${def.name} fell to the Dominion.`);
  }
  state.pendingAttack = null;
}

/**
 * Advance to the next turn: the Dominion may launch an attack on a player
 * province adjacent to its territory (the Brood never expands).
 */
export function advanceTurn(state: CampaignState): void {
  state.turn++;
  const rng = createRng(deriveSeed(state.seed, state.turn));
  if (state.pendingAttack) return; // an unanswered attack stays on the board
  const frontier = PROVINCES.filter(
    (p) => state.owners[p.id] === 'player' && p.adj.some((a) => state.owners[a] === 'enemy'),
  );
  if (frontier.length === 0) return;
  if (rng.next() < 0.55) {
    const target = frontier[rng.int(0, frontier.length - 1)]!;
    const strength = rng.int(3, 5);
    state.pendingAttack = { provinceId: target.id, strength };
    log(state, `Turn ${state.turn}: Dominion forces mass against ${target.name}.`);
  }
}

/** Auto-resolve odds for delegating a defense to the garrison. */
export function delegateHoldChance(state: CampaignState): number {
  const pending = state.pendingAttack;
  if (!pending) return 1;
  const def = provinceDef(pending.provinceId);
  const odds = 0.5 + (def.garrison - pending.strength) * 0.12;
  return Math.min(0.9, Math.max(0.15, odds));
}
