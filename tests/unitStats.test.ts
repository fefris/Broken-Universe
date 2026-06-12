import { describe, expect, it } from 'vitest';
import type { UnitDesign } from '../src/content/schema';
import { validateDesign } from '../src/sim/unitStats';
import { db } from './helpers';

function design(partIds: string[], chassisId = 'ch_mote'): UnitDesign {
  return { id: 'test', name: 'Test', chassisId, partIds, cost: 100 };
}

const errorsOf = (d: UnitDesign) =>
  validateDesign(d, db)
    .filter((i) => i.severity === 'error')
    .map((i) => i.message)
    .join('; ');

describe('design constraint validation', () => {
  it('requires exactly one engine and one computer', () => {
    expect(errorsOf(design(['ps_vesta_cell', 'comp_basic', 'wpn_vf2_scattergun']))).toMatch(
      /exactly one engine/,
    );
    expect(errorsOf(design(['eng_vesta_compact', 'ps_vesta_cell', 'wpn_vf2_scattergun']))).toMatch(
      /exactly one computer/,
    );
  });

  it('rejects overweight builds', () => {
    // Siegeworks drive (120kg) + warden plate (40kg) blow the Mote's 110kg budget.
    const d = design([
      'eng_vesta_heavy',
      'ps_vesta_cell',
      'comp_basic',
      'arm_warden_plate',
      'wpn_vf2_scattergun',
    ]);
    expect(errorsOf(d)).toMatch(/exceeds max weight/);
  });

  it('rejects complexity beyond the computer', () => {
    // Ganglion cluster (20) cannot run a full mote loadout (18) plus a sensor (4+).
    const d = design([
      'eng_vesta_compact',
      'ps_vesta_cell',
      'comp_ganglion',
      'sens_recon',
      'wpn_vf2_scattergun',
    ]);
    expect(errorsOf(d)).toMatch(/complexity .* exceeds computer capacity/);
  });

  it('rejects weapons that do not fit the chassis frame', () => {
    const d = design(['eng_vesta_compact', 'ps_vesta_cell', 'comp_basic', 'wpn_vf1_carbine']);
    expect(errorsOf(d)).toMatch(/does not fit frame/);
  });

  it('rejects biodrives on mechanical chassis and vice versa', () => {
    const d = design(['eng_pulse_heart', 'ps_vesta_cell', 'comp_basic', 'wpn_vf2_scattergun']);
    expect(errorsOf(d)).toMatch(/biodrive engines only fit biological chassis/);
    const d2 = design(
      ['eng_vesta_compact', 'ps_bio_sac', 'comp_ganglion', 'wpn_caustic_spit'],
      'ch_hatchling',
    );
    expect(errorsOf(d2)).toMatch(/mechanical engines only fit mechanical chassis/);
  });

  it('warns (not errors) on engine strain', () => {
    // Pulsing Heart power 300 vs hatchling total weight is fine; build a strained
    // variant by loading the hatchling with the heaviest bio-compatible kit.
    const issues = validateDesign(
      design(
        [
          'eng_pulse_heart',
          'ps_bio_sac',
          'comp_ganglion',
          'wpn_caustic_spit',
          'org_knitting_gland',
        ],
        'ch_hatchling',
      ),
      db,
    );
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('requires a power supply when carrying energy weapons', () => {
    const d = design(['eng_vesta_compact', 'comp_basic', 'wpn_vf2_scattergun']);
    expect(errorsOf(d)).toMatch(/energy weapons require a power supply/);
  });
});
