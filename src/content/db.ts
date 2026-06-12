import armorJson from '../../data/parts/armor.json';
import computersJson from '../../data/parts/computers.json';
import enginesJson from '../../data/parts/engines.json';
import miscJson from '../../data/parts/misc.json';
import powerSuppliesJson from '../../data/parts/power-supplies.json';
import sensorsJson from '../../data/parts/sensors.json';
import weaponsJson from '../../data/parts/weapons.json';

import chassisJson from '../../data/chassis.json';
import starterDesignsJson from '../../data/designs/starter.json';

import { z } from 'zod';
import { resolveUnit, validateDesign } from '../sim/unitStats';
import {
  ArmorPartSchema,
  type ChassisDef,
  ChassisSchema,
  ComputerSchema,
  EngineSchema,
  MiscSchema,
  type PartDef,
  PowerSupplySchema,
  type ResolvedUnit,
  SensorSchema,
  type UnitDesign,
  UnitDesignSchema,
  WeaponSchema,
} from './schema';

export interface ContentDB {
  chassis(id: string): ChassisDef | undefined;
  part(id: string): PartDef | undefined;
  allChassis: readonly ChassisDef[];
  allParts: readonly PartDef[];
  designs: readonly UnitDesign[];
  design(id: string): UnitDesign | undefined;
  /** Battle-ready stats for every shipped design, baked once at load. */
  resolved(designId: string): ResolvedUnit;
}

function indexById<T extends { id: string }>(items: T[], label: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.id)) throw new Error(`duplicate ${label} id '${item.id}'`);
    map.set(item.id, item);
  }
  return map;
}

export function loadContentDB(): ContentDB {
  const chassisList = z.array(ChassisSchema).parse(chassisJson);
  const parts: PartDef[] = [
    ...z.array(EngineSchema).parse(enginesJson),
    ...z.array(PowerSupplySchema).parse(powerSuppliesJson),
    ...z.array(ComputerSchema).parse(computersJson),
    ...z.array(SensorSchema).parse(sensorsJson),
    ...z.array(ArmorPartSchema).parse(armorJson),
    ...z.array(WeaponSchema).parse(weaponsJson),
    ...z.array(MiscSchema).parse(miscJson),
  ];
  const designs = z.array(UnitDesignSchema).parse(starterDesignsJson);

  const chassisById = indexById(chassisList, 'chassis');
  const partsById = indexById(parts, 'part');
  const designsById = indexById(designs, 'design');

  const lookup = {
    chassis: (id: string) => chassisById.get(id),
    part: (id: string) => partsById.get(id),
  };

  const resolvedById = new Map<string, ResolvedUnit>();
  for (const design of designs) {
    const errors = validateDesign(design, lookup).filter((i) => i.severity === 'error');
    if (errors.length > 0) {
      throw new Error(
        `content error in design '${design.id}': ${errors.map((e) => e.message).join('; ')}`,
      );
    }
    resolvedById.set(design.id, resolveUnit(design, lookup));
  }

  return {
    ...lookup,
    allChassis: chassisList,
    allParts: parts,
    designs,
    design: (id) => designsById.get(id),
    resolved: (designId) => {
      const r = resolvedById.get(designId);
      if (!r) throw new Error(`unknown design '${designId}'`);
      return r;
    },
  };
}
