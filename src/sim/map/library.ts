import type { Rng } from '../rng';
import { type MapDef, MapPainter, buildAshfallCrossing } from './maps';
import { TILE_BLOCKED, TILE_SLOW } from './tilemap';

/**
 * Bespoke battlefield per province. Each map carries one deploy portal per
 * neighbouring territory (compass slots matching the strategic-map directions),
 * a distinct terrain character, and a varied 3-5 PoC layout weighted toward the
 * centre so any entry portal stays playable. PoC centres are kept on open ground.
 */

/** Vesper Keep — the Dominion HQ: a walled fortress, neighbours to the south. */
function buildVesperKeep(): MapDef {
  const p = new MapPainter(110, 110);
  p.border(TILE_BLOCKED);
  p.rect(96, 188, 156, 252, TILE_BLOCKED); // west keep wall
  p.rect(284, 188, 344, 252, TILE_BLOCKED); // east keep wall
  p.rect(188, 96, 252, 140, TILE_BLOCKED); // north gatehouse
  p.rect(170, 270, 270, 320, TILE_SLOW); // courtyard rubble
  return p.build(
    'Vesper Keep',
    [
      { label: 'The Throne', pos: { x: 220, y: 220 }, radius: 14, captureSeconds: 80 },
      { label: 'West Bailey', pos: { x: 140, y: 150 }, radius: 10, captureSeconds: 55 },
      { label: 'East Bailey', pos: { x: 300, y: 150 }, radius: 10, captureSeconds: 55 },
      { label: 'South Yard', pos: { x: 220, y: 348 }, radius: 11, captureSeconds: 60 },
    ],
    p.portals(['sw', 'se']),
  );
}

/** The Rampart — a long defensive wall split by a central breach. */
function buildRampart(): MapDef {
  const p = new MapPainter(132, 88);
  p.border(TILE_BLOCKED);
  p.rect(252, 16, 276, 120, TILE_BLOCKED); // upper rampart
  p.rect(252, 232, 276, 336, TILE_BLOCKED); // lower rampart (gap in the middle)
  p.rect(120, 150, 180, 202, TILE_SLOW); // west muster
  p.rect(348, 150, 408, 202, TILE_SLOW); // east muster
  return p.build(
    'The Rampart',
    [
      { label: 'The Breach', pos: { x: 264, y: 176 }, radius: 13, captureSeconds: 75 },
      { label: 'West Wall', pos: { x: 130, y: 176 }, radius: 11, captureSeconds: 60 },
      { label: 'East Wall', pos: { x: 398, y: 176 }, radius: 11, captureSeconds: 60 },
      { label: 'North Redoubt', pos: { x: 340, y: 80 }, radius: 10, captureSeconds: 55 },
    ],
    p.portals(['ne', 'sw', 'se']),
  );
}

/** Dominion Foundry — an industrial grid of factory blocks and lanes. */
function buildFoundry(): MapDef {
  const p = new MapPainter(120, 96);
  p.border(TILE_BLOCKED);
  p.rect(120, 96, 168, 144, TILE_BLOCKED); // block A
  p.rect(312, 96, 360, 144, TILE_BLOCKED); // block B
  p.rect(120, 240, 168, 288, TILE_BLOCKED); // block C
  p.rect(312, 240, 360, 288, TILE_BLOCKED); // block D
  p.rect(216, 40, 264, 80, TILE_SLOW); // north slag
  return p.build(
    'Dominion Foundry',
    [
      { label: 'Forge Floor', pos: { x: 240, y: 192 }, radius: 14, captureSeconds: 75 },
      { label: 'NW Yard', pos: { x: 144, y: 180 }, radius: 10, captureSeconds: 55 },
      { label: 'NE Yard', pos: { x: 336, y: 180 }, radius: 10, captureSeconds: 55 },
      { label: 'South Dock', pos: { x: 240, y: 320 }, radius: 11, captureSeconds: 60 },
    ],
    p.portals(['nw', 'sw', 'se']),
  );
}

/** Ashfield — drifting ash flats: mostly slow ground, a clear central lane. */
function buildAshfield(): MapDef {
  const p = new MapPainter(128, 96);
  p.border(TILE_BLOCKED);
  p.rect(140, 120, 372, 180, TILE_SLOW); // upper ash drift
  p.rect(140, 204, 372, 264, TILE_SLOW); // lower ash drift (lane between)
  p.rect(180, 300, 210, 330, TILE_BLOCKED); // cinder cone
  p.rect(320, 60, 350, 90, TILE_BLOCKED); // cinder cone
  return p.build(
    'Ashfield',
    [
      { label: 'Cinder Heart', pos: { x: 256, y: 192 }, radius: 13, captureSeconds: 70 },
      { label: 'North Drift', pos: { x: 256, y: 90 }, radius: 11, captureSeconds: 55 },
      { label: 'South Drift', pos: { x: 256, y: 300 }, radius: 11, captureSeconds: 60 },
      { label: 'East Pan', pos: { x: 430, y: 192 }, radius: 10, captureSeconds: 55 },
      { label: 'West Pan', pos: { x: 82, y: 192 }, radius: 10, captureSeconds: 55 },
    ],
    p.portals(['ne', 'e', 's']),
  );
}

/** Mirrorlake — a wide central lake (impassable) ringed by shoreline causeways. */
function buildMirrorlake(): MapDef {
  const p = new MapPainter(120, 100);
  p.border(TILE_BLOCKED);
  p.rect(180, 150, 300, 250, TILE_BLOCKED); // the lake
  p.rect(160, 130, 320, 150, TILE_SLOW); // north marsh shore
  p.rect(160, 250, 320, 270, TILE_SLOW); // south marsh shore
  return p.build(
    'Mirrorlake',
    [
      { label: 'North Shore', pos: { x: 240, y: 110 }, radius: 11, captureSeconds: 60 },
      { label: 'South Shore', pos: { x: 240, y: 300 }, radius: 11, captureSeconds: 60 },
      { label: 'West Causeway', pos: { x: 120, y: 200 }, radius: 11, captureSeconds: 65 },
      { label: 'East Causeway', pos: { x: 360, y: 200 }, radius: 11, captureSeconds: 65 },
    ],
    p.portals(['nw', 'ne', 's']),
  );
}

/** Glasswaste — a field of jagged glass spikes for scattered hard cover. */
function buildGlasswaste(): MapDef {
  const p = new MapPainter(124, 96);
  p.border(TILE_BLOCKED);
  p.rect(160, 100, 180, 120, TILE_BLOCKED);
  p.rect(330, 110, 350, 130, TILE_BLOCKED);
  p.rect(120, 210, 140, 230, TILE_BLOCKED);
  p.rect(360, 250, 380, 270, TILE_BLOCKED);
  p.rect(230, 260, 250, 280, TILE_BLOCKED);
  p.rect(200, 150, 300, 170, TILE_SLOW); // glass dust
  return p.build(
    'Glasswaste',
    [
      { label: 'Shardfield', pos: { x: 248, y: 192 }, radius: 13, captureSeconds: 70 },
      { label: 'North Glare', pos: { x: 248, y: 80 }, radius: 10, captureSeconds: 55 },
      { label: 'East Facet', pos: { x: 410, y: 192 }, radius: 10, captureSeconds: 55 },
      { label: 'West Facet', pos: { x: 86, y: 192 }, radius: 10, captureSeconds: 55 },
      { label: 'South Quarry', pos: { x: 248, y: 300 }, radius: 11, captureSeconds: 60 },
    ],
    p.portals(['nw', 'sw', 's']),
  );
}

/** Broodfen — a sodden marsh of slow mire and spore mounds. */
function buildBroodfen(): MapDef {
  const p = new MapPainter(112, 100);
  p.border(TILE_BLOCKED);
  p.rect(80, 120, 368, 180, TILE_SLOW); // upper mire
  p.rect(80, 220, 368, 280, TILE_SLOW); // lower mire
  p.rect(150, 190, 180, 210, TILE_BLOCKED); // spore mound
  p.rect(280, 190, 310, 210, TILE_BLOCKED); // spore mound
  return p.build(
    'Broodfen',
    [
      { label: 'Spawning Pool', pos: { x: 224, y: 200 }, radius: 14, captureSeconds: 75 },
      { label: 'North Bog', pos: { x: 224, y: 90 }, radius: 11, captureSeconds: 55 },
      { label: 'South Bog', pos: { x: 224, y: 320 }, radius: 11, captureSeconds: 60 },
      { label: 'East Hollow', pos: { x: 380, y: 200 }, radius: 10, captureSeconds: 55 },
    ],
    p.portals(['n', 'se']),
  );
}

/** Hivemaw — chitinous tunnel walls carving a central corridor and chambers. */
function buildHivemaw(): MapDef {
  const p = new MapPainter(116, 96);
  p.border(TILE_BLOCKED);
  p.rect(150, 60, 170, 180, TILE_BLOCKED); // west tunnel wall (upper)
  p.rect(294, 60, 314, 180, TILE_BLOCKED); // east tunnel wall (upper)
  p.rect(150, 210, 170, 330, TILE_BLOCKED); // west tunnel wall (lower)
  p.rect(294, 210, 314, 330, TILE_BLOCKED); // east tunnel wall (lower)
  p.rect(190, 150, 274, 170, TILE_SLOW); // membrane
  return p.build(
    'Hivemaw',
    [
      { label: 'Hive Heart', pos: { x: 232, y: 192 }, radius: 13, captureSeconds: 75 },
      { label: 'North Maw', pos: { x: 232, y: 90 }, radius: 11, captureSeconds: 55 },
      { label: 'South Gut', pos: { x: 232, y: 300 }, radius: 11, captureSeconds: 60 },
      { label: 'West Chamber', pos: { x: 100, y: 192 }, radius: 10, captureSeconds: 55 },
      { label: 'East Chamber', pos: { x: 364, y: 192 }, radius: 10, captureSeconds: 55 },
    ],
    p.portals(['n', 'sw']),
  );
}

/** Verdant Steps — terraced gardens: horizontal slow bands and step walls. */
function buildVerdantSteps(): MapDef {
  const p = new MapPainter(120, 104);
  p.border(TILE_BLOCKED);
  p.rect(80, 130, 400, 150, TILE_SLOW); // upper terrace
  p.rect(80, 200, 400, 220, TILE_SLOW); // middle terrace
  p.rect(80, 270, 400, 290, TILE_SLOW); // lower terrace
  p.rect(80, 160, 180, 170, TILE_BLOCKED); // west step wall
  p.rect(300, 160, 400, 170, TILE_BLOCKED); // east step wall
  return p.build(
    'Verdant Steps',
    [
      { label: 'Central Step', pos: { x: 240, y: 208 }, radius: 13, captureSeconds: 70 },
      { label: 'Upper Terrace', pos: { x: 240, y: 100 }, radius: 11, captureSeconds: 55 },
      { label: 'Lower Terrace', pos: { x: 240, y: 330 }, radius: 11, captureSeconds: 60 },
      { label: 'West Garden', pos: { x: 120, y: 240 }, radius: 10, captureSeconds: 55 },
      { label: 'East Garden', pos: { x: 360, y: 240 }, radius: 10, captureSeconds: 55 },
    ],
    p.portals(['nw', 'ne', 'se']),
  );
}

/** Sunward Terrace — an open sunlit plateau with light rocky cover. */
function buildSunwardTerrace(): MapDef {
  const p = new MapPainter(128, 92);
  p.border(TILE_BLOCKED);
  p.rect(170, 90, 200, 120, TILE_BLOCKED); // rock
  p.rect(312, 90, 342, 120, TILE_BLOCKED); // rock
  p.rect(240, 250, 272, 280, TILE_BLOCKED); // rock
  p.rect(180, 160, 332, 210, TILE_SLOW); // sun-cracked ground
  return p.build(
    'Sunward Terrace',
    [
      { label: 'Sun Altar', pos: { x: 256, y: 184 }, radius: 14, captureSeconds: 75 },
      { label: 'NW Rise', pos: { x: 130, y: 110 }, radius: 10, captureSeconds: 55 },
      { label: 'NE Rise', pos: { x: 382, y: 110 }, radius: 10, captureSeconds: 55 },
      { label: 'South Pan', pos: { x: 256, y: 310 }, radius: 11, captureSeconds: 60 },
    ],
    p.portals(['nw', 'ne', 'sw']),
  );
}

/** Aurora Bastion — the Concord HQ: a fortress mirroring the Keep, gates north. */
function buildAuroraBastion(): MapDef {
  const p = new MapPainter(112, 108);
  p.border(TILE_BLOCKED);
  p.rect(96, 210, 156, 274, TILE_BLOCKED); // west wall
  p.rect(292, 210, 352, 274, TILE_BLOCKED); // east wall
  p.rect(188, 300, 260, 340, TILE_BLOCKED); // south gatehouse
  p.rect(174, 150, 274, 196, TILE_SLOW); // courtyard
  return p.build(
    'Aurora Bastion',
    [
      { label: 'Command Spire', pos: { x: 224, y: 216 }, radius: 14, captureSeconds: 80 },
      { label: 'NW Tower', pos: { x: 130, y: 120 }, radius: 10, captureSeconds: 55 },
      { label: 'NE Tower', pos: { x: 318, y: 120 }, radius: 10, captureSeconds: 55 },
      { label: 'North Plaza', pos: { x: 224, y: 90 }, radius: 11, captureSeconds: 55 },
    ],
    p.portals(['nw', 'ne']),
  );
}

/** Province id -> battlefield builder. Calderis Crossroads reuses Ashfall Crossing. */
export const PROVINCE_MAPS: Record<string, () => MapDef> = {
  keep: buildVesperKeep,
  rampart: buildRampart,
  foundry: buildFoundry,
  ashfield: buildAshfield,
  mirrorlake: buildMirrorlake,
  glasswaste: buildGlasswaste,
  broodfen: buildBroodfen,
  crossroads: buildAshfallCrossing,
  hivemaw: buildHivemaw,
  verdant: buildVerdantSteps,
  terrace: buildSunwardTerrace,
  bastion: buildAuroraBastion,
};

/** The battlefield for a province (falls back to Ashfall Crossing if unknown). */
export function mapForProvince(provinceId: string): MapDef {
  return (PROVINCE_MAPS[provinceId] ?? buildAshfallCrossing)();
}

const MAP_IDS = Object.keys(PROVINCE_MAPS);

/** A deterministically chosen battlefield, for skirmish play. */
export function randomMap(rng: Rng): MapDef {
  const id = MAP_IDS[rng.int(0, MAP_IDS.length - 1)] ?? 'crossroads';
  return mapForProvince(id);
}
