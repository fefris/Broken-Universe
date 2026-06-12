import { describe, expect, it } from 'vitest';
import { validateDesign } from '../src/sim/unitStats';
import { db } from './helpers';

describe('content database', () => {
  it('loads and resolves every shipped design without errors', () => {
    expect(db.designs.length).toBe(12);
    for (const design of db.designs) {
      const errors = validateDesign(design, db).filter((i) => i.severity === 'error');
      expect(errors, `design ${design.id}`).toEqual([]);
      expect(() => db.resolved(design.id)).not.toThrow();
    }
  });

  it('bakes the Mote to its designed battle stats', () => {
    const mote = db.resolved('d_mote');
    expect(mote.maxHealth).toBe(1650); // 1000 base + 450 engine + 200 flak jacket
    expect(mote.armor).toBe(8); // 4 base + 4 flak jacket
    expect(mote.armorClass).toBe('deflective');
    expect(mote.speed).toBeCloseTo(3.4); // no engine strain
    expect(mote.energyMax).toBe(6600);
    expect(mote.weapons).toHaveLength(1);
    expect(mote.weapons[0]?.ground?.damage).toBe(90);
  });

  it('applies sensor range bonus to weapons (Skyspike flak 26 + 4 = 30)', () => {
    const skyspike = db.resolved('d_skyspike');
    expect(skyspike.weapons[0]?.air?.range).toBe(30);
    expect(skyspike.viewRange).toBeCloseTo(10.5); // 6.5 chassis + 4 longwatch
  });

  it('gives bioforms organic armor class and regen', () => {
    const hatchling = db.resolved('d_hatchling');
    expect(hatchling.armorClass).toBe('organic');
    expect(hatchling.regenHps).toBe(8);
  });

  it('covers every division in the starter roster', () => {
    const divisions = new Set(db.designs.map((d) => db.resolved(d.id).division));
    expect(divisions).toEqual(new Set(['infantry', 'mechanized', 'aerial', 'bioform']));
  });
});
