import { describe, expect, it } from 'vitest';
import { AFFINITY, computeDamage } from '../src/sim/damage';

describe('damage model', () => {
  it('subtracts armor flat from affinity-scaled damage', () => {
    // 100 kinetic vs ablative (x1.0) with 20 armor -> 80
    expect(computeDamage(100, 'kinetic', 20, 'ablative')).toBe(80);
  });

  it('applies the affinity matrix', () => {
    // beam vs reflec is resisted: 100 * 0.6 - 0 = 60
    expect(computeDamage(100, 'beam', 0, 'reflec')).toBe(60);
    // flame vs organic burns: 100 * 1.3 - 0 = 130
    expect(computeDamage(100, 'flame', 0, 'organic')).toBe(130);
  });

  it('floors damage at 5% of base against heavy armor', () => {
    // 90 kinetic vs deflective (67.5) minus 60 armor = 7.5 -> floor sets 4.5 -> 4? no:
    // max(7.5, 4.5, 1) = 7.5 -> 7
    expect(computeDamage(90, 'kinetic', 60, 'deflective')).toBe(7);
    // Overwhelming armor: max(-90, 4.5, 1) -> 4
    expect(computeDamage(90, 'kinetic', 200, 'deflective')).toBe(4);
  });

  it('never deals less than 1', () => {
    expect(computeDamage(5, 'kinetic', 500, 'deflective')).toBe(1);
  });

  it('has a complete 4x4 matrix', () => {
    for (const row of Object.values(AFFINITY)) {
      expect(Object.keys(row).sort()).toEqual(['ablative', 'deflective', 'organic', 'reflec']);
    }
  });
});
