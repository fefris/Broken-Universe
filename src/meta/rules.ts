/**
 * Hero attribute effects, faithful to Shattered Galaxy's four stats:
 * - Tactics: command-point budget for the fielded squad (better/more units).
 * - Clout: how many units you can field at once and hold in reserve,
 *   plus access to heavier chassis (SG "Influence").
 * - Education: tech-level gate for equipping parts (level + Education/2).
 * - Mechanical Aptitude: expands chassis weight budgets (~1% per point).
 */
export interface HeroAttributes {
  tactics: number;
  education: number;
  clout: number;
  mech: number;
}

export const ATTRIBUTE_LABELS: Record<keyof HeroAttributes, string> = {
  tactics: 'Tactics',
  education: 'Education',
  clout: 'Clout',
  mech: 'Mechanical Aptitude',
};

/** Units fielded simultaneously (SG squads ran 6-12). */
export function fieldCap(attrs: HeroAttributes): number {
  return Math.min(12, 6 + Math.floor(attrs.clout / 5));
}

/** Reserve pool size. */
export function reserveCap(attrs: HeroAttributes): number {
  return Math.min(24, 4 + Math.floor(attrs.clout / 3));
}

/** Command points available for the fielded squad. */
export function cpBudget(attrs: HeroAttributes): number {
  return 60 + attrs.tactics * 2;
}

/** Command-point price of one unit, from its credit cost. */
export function cpCost(unitCost: number): number {
  return Math.ceil(unitCost / 25);
}

/** Max tech level of parts a unit may NEWLY equip in the garage. */
export function techGate(unitLevel: number, attrs: HeroAttributes): number {
  return unitLevel + Math.floor(attrs.education / 2);
}

/** Max chassis tech level the hero may buy. */
export function chassisGate(rank: number, attrs: HeroAttributes): number {
  return rank * 2 + Math.floor(attrs.clout / 10);
}

/** Mechanical Aptitude weight-budget multiplier (capped at +100%). */
export function maxWeightMult(attrs: HeroAttributes): number {
  return 1 + Math.min(attrs.mech, 100) / 100;
}

/** Veterancy: +2% max health per level past 1, capped at +40%. */
export function healthMult(unitLevel: number): number {
  return 1 + Math.min(Math.max(unitLevel - 1, 0), 20) * 0.02;
}

/** Fraction of a destroyed unit's cost charged as field repairs. */
export const REPAIR_COST_FRACTION = 0.3;

/** Resale fraction when scrapping a unit in the garage. */
export const SELL_FRACTION = 0.7;
