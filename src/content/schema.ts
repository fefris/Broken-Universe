import { z } from 'zod';

/**
 * Content schemas for the faithful Shattered Galaxy parts system.
 * A unit design = chassis + fitted parts (engine, power supply, computer,
 * sensors, armor, weapons, misc), subject to five simultaneous budgets:
 * weight, space, complexity (vs computer), engine power (vs total weight),
 * and energy (weapons drain the power supply's pool in battle).
 */

export const DivisionSchema = z.enum(['infantry', 'mechanized', 'aerial', 'bioform']);
export type Division = z.infer<typeof DivisionSchema>;

export const LocomotionSchema = z.enum(['ground', 'hover', 'air']);
export type Locomotion = z.infer<typeof LocomotionSchema>;

export const DamageTypeSchema = z.enum(['kinetic', 'beam', 'missile', 'flame']);
export type DamageType = z.infer<typeof DamageTypeSchema>;

export const ArmorClassSchema = z.enum(['deflective', 'ablative', 'reflec', 'organic']);
export type ArmorClass = z.infer<typeof ArmorClassSchema>;

export const ChassisSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  division: DivisionSchema,
  /** Weapon family key: a weapon lists the frames it fits. */
  frame: z.string().min(1),
  techLevel: z.number().int().min(1),
  bodyType: z.enum(['mechanical', 'biological']),
  locomotion: LocomotionSchema,
  baseHealth: z.number().positive(),
  baseArmor: z.number().min(0),
  /** Meters per second. */
  speed: z.number().positive(),
  /** Sight radius in meters. */
  viewRange: z.number().positive(),
  /** Collision/selection radius in meters. */
  radius: z.number().positive(),
  /** The chassis' own mass (kg), before parts. */
  unitWeight: z.number().positive(),
  /** Budget for the summed weight of fitted parts (kg). */
  maxWeight: z.number().positive(),
  /** Budget for the summed space of fitted parts (L). */
  maxSpace: z.number().positive(),
  slots: z.number().int().positive(),
});
export type ChassisDef = z.infer<typeof ChassisSchema>;

const PartBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  techLevel: z.number().int().min(1),
  weight: z.number().min(0),
  space: z.number().min(0),
  complexity: z.number().min(0),
  /** Passive energy drain in kJ/s while the unit lives. */
  passiveDrain: z.number().min(0),
});

export const FireModeSchema = z.object({
  damage: z.number().positive(),
  /** Meters; sensors add their rangeBonus on top. */
  range: z.number().positive(),
  /** Seconds between shots. */
  cooldown: z.number().positive(),
  /** Full damage to all enemies within this radius (meters). */
  splashRadius: z.number().positive().optional(),
  /** Cannot fire at targets closer than this (meters). */
  minRange: z.number().positive().optional(),
});
export type FireMode = z.infer<typeof FireModeSchema>;

export const EngineSchema = PartBaseSchema.extend({
  kind: z.literal('engine'),
  /** Must cover total unit weight or the unit suffers engine strain. */
  power: z.number().positive(),
  healthBonus: z.number().min(0),
  /** Biodrives fit biological chassis; mechanical engines fit mechanical. */
  biodrive: z.boolean(),
});

export const PowerSupplySchema = PartBaseSchema.extend({
  kind: z.literal('powerSupply'),
  maxEnergy: z.number().positive(),
  /** kJ/s recharge. */
  recharge: z.number().positive(),
});

export const ComputerSchema = PartBaseSchema.extend({
  kind: z.literal('computer'),
  /** Must cover the summed complexity of all other parts. */
  maxComplexity: z.number().positive(),
});

export const SensorSchema = PartBaseSchema.extend({
  kind: z.literal('sensor'),
  /** Added to chassis view range (meters). */
  viewBonus: z.number().min(0),
  /** Added to every weapon fire mode's range (meters). */
  rangeBonus: z.number().min(0),
});

export const ArmorPartSchema = PartBaseSchema.extend({
  kind: z.literal('armor'),
  armor: z.number().min(0),
  healthBonus: z.number().min(0),
  armorClass: ArmorClassSchema,
});

export const WeaponSchema = PartBaseSchema.extend({
  kind: z.literal('weapon'),
  /** Chassis frames this weapon fits. */
  frames: z.array(z.string().min(1)).min(1),
  damageType: DamageTypeSchema,
  ground: FireModeSchema.optional(),
  air: FireModeSchema.optional(),
  energyPerShot: z.number().min(0),
  /** Meters per second; omitted = hitscan. */
  projectileSpeed: z.number().positive().optional(),
  /** Indirect (lobbed) fire ignores line of sight. */
  indirect: z.boolean().optional(),
}).refine((w) => w.ground !== undefined || w.air !== undefined, {
  message: 'weapon needs at least one fire mode',
});

export const MiscSchema = PartBaseSchema.extend({
  kind: z.literal('misc'),
  effect: z.discriminatedUnion('type', [
    /** Heals a nearby damaged ally (Mender). */
    z.object({
      type: z.literal('repair'),
      hps: z.number().positive(),
      range: z.number().positive(),
    }),
    /** Passive self-regeneration (bioforms). */
    z.object({ type: z.literal('regen'), hps: z.number().positive() }),
  ]),
});

export const PartSchema = z.discriminatedUnion('kind', [
  EngineSchema,
  PowerSupplySchema,
  ComputerSchema,
  SensorSchema,
  ArmorPartSchema,
  MiscSchema,
]);
// Weapon uses .refine() so it can't join the discriminated union; handled separately.
export type EngineDef = z.infer<typeof EngineSchema>;
export type PowerSupplyDef = z.infer<typeof PowerSupplySchema>;
export type ComputerDef = z.infer<typeof ComputerSchema>;
export type SensorDef = z.infer<typeof SensorSchema>;
export type ArmorPartDef = z.infer<typeof ArmorPartSchema>;
export type WeaponDef = z.infer<typeof WeaponSchema>;
export type MiscDef = z.infer<typeof MiscSchema>;
export type PartDef = z.infer<typeof PartSchema> | WeaponDef;

export const UnitDesignSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  chassisId: z.string().min(1),
  partIds: z.array(z.string().min(1)).min(1),
  cost: z.number().positive(),
});
export type UnitDesign = z.infer<typeof UnitDesignSchema>;

/** Flat battle-ready stats baked from chassis + parts by resolveUnit(). */
export interface ResolvedWeapon {
  partId: string;
  name: string;
  damageType: DamageType;
  energyPerShot: number;
  projectileSpeed?: number;
  indirect: boolean;
  ground?: FireMode;
  air?: FireMode;
}

export interface ResolvedUnit {
  designId: string;
  name: string;
  division: Division;
  locomotion: Locomotion;
  radius: number;
  maxHealth: number;
  armor: number;
  armorClass: ArmorClass;
  speed: number;
  viewRange: number;
  weapons: ResolvedWeapon[];
  energyMax: number;
  energyRecharge: number;
  passiveDrain: number;
  repair?: { hps: number; range: number };
  regenHps: number;
  cost: number;
}
