import type { ArmorClass, DamageType } from '../content/schema';
import { DAMAGE_FLOOR_FRACTION } from './constants';

/**
 * Damage-type vs armor-class multipliers. SG documented these affinities only
 * qualitatively (e.g. reflec resists lasers); the numbers are ours.
 */
export const AFFINITY: Record<DamageType, Record<ArmorClass, number>> = {
  kinetic: { deflective: 0.75, ablative: 1.0, reflec: 1.1, organic: 1.0 },
  beam: { deflective: 1.1, ablative: 1.0, reflec: 0.6, organic: 1.0 },
  missile: { deflective: 1.0, ablative: 0.8, reflec: 1.0, organic: 1.1 },
  flame: { deflective: 0.9, ablative: 1.0, reflec: 1.0, organic: 1.3 },
};

/**
 * SG combat is deterministic: no to-hit rolls. Armor subtracts flat from
 * affinity-scaled damage, with a floor so massed cheap fire always tells.
 */
export function computeDamage(
  baseDamage: number,
  damageType: DamageType,
  targetArmor: number,
  targetClass: ArmorClass,
): number {
  const scaled = baseDamage * AFFINITY[damageType][targetClass];
  return Math.floor(Math.max(scaled - targetArmor, baseDamage * DAMAGE_FLOOR_FRACTION, 1));
}
