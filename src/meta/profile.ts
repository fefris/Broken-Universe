import type { ContentDB } from '../content/db';
import type { UnitDesign } from '../content/schema';
import type { CampaignState } from './campaign';
import type { HeroAttributes } from './rules';
import { PLAYER_SQUAD } from './starterArmy';
import { heroRank } from './xp';

/**
 * One owned unit IS a design: a chassis with an individually fitted loadout
 * (SG-faithful — every unit in your army is outfitted separately).
 */
export interface OwnedUnit {
  uid: string;
  name: string;
  chassisId: string;
  partIds: string[];
  xp: number;
}

/**
 * A saved muster preset: an ordered list of unit uids (field picks first,
 * then reserves — same shape as lastSquad) the player can switch in quickly.
 */
export interface SquadGroup {
  name: string;
  uids: string[];
}

export interface Profile {
  version: number;
  heroName: string;
  heroXp: number;
  /** Rank for which attribute points were last granted. */
  pointsGrantedAtRank: number;
  attrPoints: number;
  attributes: HeroAttributes;
  credits: number;
  units: OwnedUnit[];
  nextUid: number;
  /** Last squad selection (uids), restored in the squad picker. */
  lastSquad: string[];
  /** Named muster presets the player can switch between. */
  squadGroups: SquadGroup[];
  campaign: CampaignState | null;
}

export const PROFILE_VERSION = 1;
const STORAGE_KEY = 'broken-universe-profile-v1';

export function ownedToDesign(unit: OwnedUnit): UnitDesign {
  return { id: unit.uid, name: unit.name, chassisId: unit.chassisId, partIds: [...unit.partIds] };
}

/** Fresh profile: rank 4 hero with the classic starter army. */
export function defaultProfile(db: ContentDB): Profile {
  const units: OwnedUnit[] = [];
  let nextUid = 1;
  for (const designId of [...PLAYER_SQUAD.squad, ...PLAYER_SQUAD.reserves]) {
    const design = db.design(designId);
    if (!design) continue;
    units.push({
      uid: `u${nextUid++}`,
      name: design.name,
      chassisId: design.chassisId,
      partIds: [...design.partIds],
      xp: 0,
    });
  }
  return {
    version: PROFILE_VERSION,
    heroName: 'Commander',
    heroXp: 6400, // rank 4
    pointsGrantedAtRank: 4,
    attrPoints: 0,
    attributes: { tactics: 20, education: 16, clout: 20, mech: 10 },
    credits: 300,
    units,
    nextUid,
    lastSquad: units.slice(0, 10).map((u) => u.uid),
    squadGroups: [],
    campaign: null,
  };
}

export function profileRank(profile: Profile): number {
  return heroRank(profile.heroXp);
}

/** A group's uids filtered to units the profile still owns, order preserved. */
export function groupValidUids(group: SquadGroup, profile: Profile): string[] {
  const owned = new Set(profile.units.map((u) => u.uid));
  return group.uids.filter((uid) => owned.has(uid));
}

/** Save (or overwrite a same-named) squad group. Returns the updated list. */
export function upsertSquadGroup(profile: Profile, name: string, uids: string[]): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const existing = profile.squadGroups.find((g) => g.name === trimmed);
  if (existing) existing.uids = [...uids];
  else profile.squadGroups.push({ name: trimmed, uids: [...uids] });
}

export function deleteSquadGroup(profile: Profile, name: string): void {
  profile.squadGroups = profile.squadGroups.filter((g) => g.name !== name);
}

/** Fill in fields absent from older saved profiles. */
function migrate(profile: Profile): Profile {
  if (!Array.isArray(profile.squadGroups)) profile.squadGroups = [];
  return profile;
}

/** Storage abstraction so tests run without a DOM. */
export interface ProfileStore {
  load(): Profile | null;
  save(profile: Profile): void;
  clear(): void;
}

export function createLocalStorageStore(): ProfileStore {
  return {
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Profile;
        if (parsed.version !== PROFILE_VERSION) return null;
        return migrate(parsed);
      } catch {
        return null;
      }
    },
    save(profile) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      } catch {
        // Storage full or unavailable: the run continues unsaved.
      }
    },
    clear() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    },
  };
}

export function createMemoryStore(): ProfileStore {
  let saved: string | null = null;
  return {
    load: () => (saved ? migrate(JSON.parse(saved) as Profile) : null),
    save(profile) {
      saved = JSON.stringify(profile);
    },
    clear() {
      saved = null;
    },
  };
}
