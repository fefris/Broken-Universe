import type {
  ArmorPartDef,
  ChassisDef,
  ComputerDef,
  EngineDef,
  MiscDef,
  PartDef,
  PowerSupplyDef,
  ResolvedUnit,
  ResolvedWeapon,
  SensorDef,
  UnitDesign,
  WeaponDef,
} from '../content/schema';
import { STRAIN_DRAIN_MULT, STRAIN_SPEED_MULT } from './constants';

/** Lookup interface satisfied by the content DB (and by test fixtures). */
export interface ContentLookup {
  chassis(id: string): ChassisDef | undefined;
  part(id: string): PartDef | undefined;
}

export interface DesignIssue {
  severity: 'error' | 'warning';
  message: string;
}

interface GatheredParts {
  chassis: ChassisDef;
  parts: PartDef[];
  engines: EngineDef[];
  powerSupplies: PowerSupplyDef[];
  computers: ComputerDef[];
  sensors: SensorDef[];
  armors: ArmorPartDef[];
  weapons: WeaponDef[];
  miscs: MiscDef[];
  totalPartWeight: number;
}

function gather(design: UnitDesign, db: ContentLookup): GatheredParts | string {
  const chassis = db.chassis(design.chassisId);
  if (!chassis) return `unknown chassis '${design.chassisId}'`;
  const parts: PartDef[] = [];
  for (const id of design.partIds) {
    const part = db.part(id);
    if (!part) return `unknown part '${id}'`;
    parts.push(part);
  }
  const byKind = <K extends PartDef['kind']>(kind: K) =>
    parts.filter((p): p is Extract<PartDef, { kind: K }> => p.kind === kind);
  return {
    chassis,
    parts,
    engines: byKind('engine'),
    powerSupplies: byKind('powerSupply'),
    computers: byKind('computer'),
    sensors: byKind('sensor'),
    armors: byKind('armor'),
    weapons: byKind('weapon'),
    miscs: byKind('misc'),
    totalPartWeight: parts.reduce((sum, p) => sum + p.weight, 0),
  };
}

/**
 * Hero-driven modifiers applied when a design is validated or baked.
 * maxWeightMult: Mechanical Aptitude expands the weight budget (SG: ~1%/pt).
 * healthMult: unit veterancy bonus applied to final max health.
 */
export interface DesignMods {
  maxWeightMult?: number;
  healthMult?: number;
}

/**
 * Enforce the five SG design constraints plus fitting rules.
 * Engine strain is a warning (the design works, but slower and hungrier).
 */
export function validateDesign(
  design: UnitDesign,
  db: ContentLookup,
  mods?: DesignMods,
): DesignIssue[] {
  const g = gather(design, db);
  if (typeof g === 'string') return [{ severity: 'error', message: g }];
  const issues: DesignIssue[] = [];
  const err = (message: string) => issues.push({ severity: 'error', message });
  const warn = (message: string) => issues.push({ severity: 'warning', message });
  const { chassis, parts } = g;

  if (parts.length > chassis.slots) {
    err(`${parts.length} parts exceed ${chassis.slots} slots`);
  }
  const weightBudget = Math.round(chassis.maxWeight * (mods?.maxWeightMult ?? 1));
  if (g.totalPartWeight > weightBudget) {
    err(`part weight ${g.totalPartWeight} exceeds max weight ${weightBudget}`);
  }
  const totalSpace = parts.reduce((sum, p) => sum + p.space, 0);
  if (totalSpace > chassis.maxSpace) {
    err(`part space ${totalSpace} exceeds max space ${chassis.maxSpace}`);
  }

  if (g.engines.length !== 1) err(`exactly one engine required, found ${g.engines.length}`);
  if (g.computers.length !== 1) err(`exactly one computer required, found ${g.computers.length}`);
  if (g.powerSupplies.length > 1) err('at most one power supply');
  if (g.armors.length > 1) err('at most one armor');
  if (g.sensors.length > 1) err('at most one sensor');
  if (g.weapons.length === 0 && !g.miscs.some((m) => m.effect.type === 'repair')) {
    err('design needs a weapon or a repair tool');
  }

  const computer = g.computers[0];
  if (computer) {
    const otherComplexity = parts
      .filter((p) => p.kind !== 'computer')
      .reduce((sum, p) => sum + p.complexity, 0);
    if (otherComplexity > computer.maxComplexity) {
      err(`complexity ${otherComplexity} exceeds computer capacity ${computer.maxComplexity}`);
    }
  }

  const engine = g.engines[0];
  if (engine) {
    if (engine.biodrive !== (chassis.bodyType === 'biological')) {
      err(
        engine.biodrive
          ? 'biodrive engines only fit biological chassis'
          : 'mechanical engines only fit mechanical chassis',
      );
    }
    const totalWeight = chassis.unitWeight + g.totalPartWeight;
    if (engine.power < totalWeight) {
      warn(`engine strain: power ${engine.power} < total weight ${totalWeight}`);
    }
  }

  for (const w of g.weapons) {
    if (!w.frames.includes(chassis.frame)) {
      err(`weapon '${w.id}' does not fit frame '${chassis.frame}'`);
    }
  }
  if (g.weapons.some((w) => w.energyPerShot > 0) && g.powerSupplies.length === 0) {
    err('energy weapons require a power supply');
  }

  return issues;
}

/** Total credit price of a design: hull plus every fitted part. */
export function designCost(design: UnitDesign, db: ContentLookup): number {
  const g = gather(design, db);
  if (typeof g === 'string') throw new Error(g);
  return g.chassis.cost + g.parts.reduce((sum, p) => sum + p.cost, 0);
}

/** Bake a valid design into flat battle stats. Throws on validation errors. */
export function resolveUnit(
  design: UnitDesign,
  db: ContentLookup,
  mods?: DesignMods,
): ResolvedUnit {
  const issues = validateDesign(design, db, mods);
  const errors = issues.filter((i) => i.severity === 'error');
  if (errors.length > 0) {
    throw new Error(`invalid design '${design.id}': ${errors.map((e) => e.message).join('; ')}`);
  }
  const g = gather(design, db);
  if (typeof g === 'string') throw new Error(g);
  const { chassis } = g;

  const engine = g.engines[0]!;
  const armor = g.armors[0];
  const sensor = g.sensors[0];
  const supply = g.powerSupplies[0];

  const totalWeight = chassis.unitWeight + g.totalPartWeight;
  const strained = engine.power < totalWeight;
  const rawDrain = g.parts.reduce((sum, p) => sum + p.passiveDrain, 0);

  const weapons: ResolvedWeapon[] = g.weapons.map((w) => ({
    partId: w.id,
    name: w.name,
    damageType: w.damageType,
    energyPerShot: w.energyPerShot,
    indirect: w.indirect ?? false,
    ...(w.projectileSpeed !== undefined && { projectileSpeed: w.projectileSpeed }),
    ...(w.ground && { ground: { ...w.ground, range: w.ground.range + (sensor?.rangeBonus ?? 0) } }),
    ...(w.air && { air: { ...w.air, range: w.air.range + (sensor?.rangeBonus ?? 0) } }),
  }));

  const repairMisc = g.miscs.find((m) => m.effect.type === 'repair');
  const regenHps = g.miscs.reduce(
    (sum, m) => sum + (m.effect.type === 'regen' ? m.effect.hps : 0),
    0,
  );

  return {
    designId: design.id,
    name: design.name,
    division: chassis.division,
    locomotion: chassis.locomotion,
    radius: chassis.radius,
    maxHealth: Math.round(
      (chassis.baseHealth + engine.healthBonus + (armor?.healthBonus ?? 0)) *
        (mods?.healthMult ?? 1),
    ),
    armor: chassis.baseArmor + (armor?.armor ?? 0),
    armorClass: armor?.armorClass ?? (chassis.bodyType === 'biological' ? 'organic' : 'deflective'),
    speed: chassis.speed * (strained ? STRAIN_SPEED_MULT : 1),
    viewRange: chassis.viewRange + (sensor?.viewBonus ?? 0),
    weapons,
    energyMax: supply?.maxEnergy ?? 0,
    energyRecharge: supply?.recharge ?? 0,
    passiveDrain: rawDrain * (strained ? STRAIN_DRAIN_MULT : 1),
    ...(repairMisc &&
      repairMisc.effect.type === 'repair' && {
        repair: { hps: repairMisc.effect.hps, range: repairMisc.effect.range },
      }),
    regenHps,
    cost: chassis.cost + g.parts.reduce((sum, p) => sum + p.cost, 0),
  };
}
