/**
 * Inline SVG icon set for the Broken Universe command UI.
 *
 * Every glyph is authored on a 24x24 grid and uses `currentColor` so the CSS
 * `color` property tints it (matching the amber/cyan accent system). Glyphs are
 * intentionally bold and high-contrast so they stay legible at the default 16px.
 *
 * WHY strings (not nodes): the whole DOM UI is built from template literals via
 * src/ui/dom.ts, so an icon must drop straight into an HTML string.
 */

export type IconName =
  // divisions
  | 'div-infantry'
  | 'div-mechanized'
  | 'div-aerial'
  | 'div-bioform'
  // parts
  | 'part-engine'
  | 'part-powerSupply'
  | 'part-computer'
  | 'part-sensor'
  | 'part-armor'
  | 'part-weapon'
  | 'part-misc'
  // resources
  | 'credits'
  | 'cp'
  | 'xp'
  | 'rank'
  // factions
  | 'faction-player'
  | 'faction-enemy'
  | 'faction-brood'
  // bonuses
  | 'bonus-hq'
  | 'bonus-factory'
  | 'bonus-simulator'
  // ui
  | 'attack'
  | 'defend'
  | 'target'
  | 'timer'
  | 'chevron'
  | 'close'
  | 'plus'
  | 'save'
  | 'trash';

export interface IconOpts {
  size?: number;
  cls?: string;
}

/**
 * Each entry is the INNER markup of a 24x24 viewBox. Paths use fill or stroke =
 * currentColor. Where stroke is used we set non-scaling-friendly widths around
 * 1.6–2 so the shapes read crisply at 16px.
 */
const GLYPHS: Record<IconName, string> = {
  // ----- divisions -------------------------------------------------------
  // Infantry: NATO-style box with a single diagonal (light infantry feel).
  'div-infantry':
    '<rect x="3" y="6" width="18" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<path d="M3.6 6.6 20.4 17.4M20.4 6.6 3.6 17.4" stroke="currentColor" stroke-width="1.6"/>',
  // Mechanized: tracked-vehicle silhouette — hull + turret + tread wheels.
  'div-mechanized':
    '<path d="M4 13h13l3-3v-2h-5l-2-2H6v4H4z" fill="currentColor"/>' +
    '<circle cx="7" cy="17" r="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<circle cx="14" cy="17" r="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<path d="M5 19.5h11" stroke="currentColor" stroke-width="1.4"/>',
  // Aerial: swept delta wing / jet pointing up-right.
  'div-aerial': '<path d="M2 20 12 3l3 7 7 3-7 1-1 6-4-7z" fill="currentColor"/>',
  // Bioform: hex carapace with a central spore dot — organic/alien.
  'div-bioform':
    '<path d="M12 2 20 7v10l-8 5-8-5V7z" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<circle cx="12" cy="12" r="3" fill="currentColor"/>',

  // ----- parts -----------------------------------------------------------
  // Engine: piston/thruster block with exhaust flare.
  'part-engine':
    '<rect x="4" y="8" width="11" height="8" rx="1" fill="currentColor"/>' +
    '<path d="M15 9.5h3l3-2v9l-3-2h-3z" fill="currentColor"/>' +
    '<path d="M6 5v3M10 5v3" stroke="currentColor" stroke-width="1.8"/>',
  // Power supply: lightning bolt in a cell.
  'part-powerSupply':
    '<rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<path d="M13 6 8 13h3l-1 5 5-7h-3z" fill="currentColor"/>',
  // Computer: chip with pins (legs on all sides) and a core square.
  'part-computer':
    '<rect x="7" y="7" width="10" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<rect x="10" y="10" width="4" height="4" fill="currentColor"/>' +
    '<path d="M9 7V4M12 7V4M15 7V4M9 20v-3M12 20v-3M15 20v-3M7 9H4M7 12H4M7 15H4M20 9h-3M20 12h-3M20 15h-3" stroke="currentColor" stroke-width="1.5"/>',
  // Sensor: radar dish sweep arcs.
  'part-sensor':
    '<circle cx="12" cy="12" r="2" fill="currentColor"/>' +
    '<path d="M12 7a5 5 0 0 1 5 5" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<path d="M12 16v5" stroke="currentColor" stroke-width="1.8"/>',
  // Armor: heraldic shield with reinforcing bar.
  'part-armor':
    '<path d="M12 2 4 5v7c0 5 3.5 8 8 10 4.5-2 8-5 8-10V5z" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<path d="M12 6v12M6 9h12" stroke="currentColor" stroke-width="1.4"/>',
  // Weapon: stylized cannon / rifle silhouette.
  'part-weapon':
    '<path d="M3 10h13l5-2v3l-4 1v2h-3l-1 3H8l-1-3H3z" fill="currentColor"/>' +
    '<path d="M5 16l-2 4" stroke="currentColor" stroke-width="1.8"/>',
  // Misc: modular cube / generic component box.
  'part-misc':
    '<path d="M12 3 21 8v8l-9 5-9-5V8z" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<path d="M3 8l9 5 9-5M12 13v8" stroke="currentColor" stroke-width="1.4"/>',

  // ----- resources -------------------------------------------------------
  // Credits: coin with a vertical slash currency mark.
  credits:
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<path d="M12 6v12M9 9h5a2 2 0 0 1 0 4H9h6" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  // CP (command points): hex pip cluster.
  cp:
    '<path d="M12 2 20 7v10l-8 5-8-5V7z" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<circle cx="12" cy="9" r="1.6" fill="currentColor"/>' +
    '<circle cx="9" cy="14" r="1.6" fill="currentColor"/>' +
    '<circle cx="15" cy="14" r="1.6" fill="currentColor"/>',
  // XP: rising star/spark.
  xp: '<path d="M12 2l2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5z" fill="currentColor"/>',
  // Rank: chevron stack (NCO stripes).
  rank:
    '<path d="M4 9l8-5 8 5" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<path d="M4 14l8-5 8 5" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<path d="M4 19l8-5 8 5" fill="none" stroke="currentColor" stroke-width="2"/>',

  // ----- factions --------------------------------------------------------
  // Player: upward arrowhead in a ring (allied command).
  'faction-player':
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<path d="M12 6l5 10H7z" fill="currentColor"/>',
  // Enemy: angular skull-less hostile mark — inverted spiked triangle.
  'faction-enemy':
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<path d="M7 8h10l-5 9z" fill="currentColor"/>',
  // Brood: many-legged organic node.
  'faction-brood':
    '<circle cx="12" cy="12" r="4" fill="currentColor"/>' +
    '<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" stroke="currentColor" stroke-width="1.8"/>',

  // ----- bonuses ---------------------------------------------------------
  // HQ: flag on a mast (command headquarters).
  'bonus-hq':
    '<path d="M6 3v18" stroke="currentColor" stroke-width="2"/>' +
    '<path d="M6 4h11l-2.5 3L17 10H6z" fill="currentColor"/>',
  // Factory: building with sawtooth roof + chimney.
  'bonus-factory':
    '<path d="M3 21V11l5 3v-3l5 3V8l5 3v10z" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<path d="M17 8V4h2v5" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  // Simulator: monitor screen with waveform (training sim).
  'bonus-simulator':
    '<rect x="3" y="4" width="18" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<path d="M6 11l2-3 2 4 2-5 2 4 2-2" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<path d="M9 20h6M12 16v4" stroke="currentColor" stroke-width="1.8"/>',

  // ----- ui --------------------------------------------------------------
  // Attack: crossed sabres / strike chevrons pointing out.
  attack:
    '<path d="M5 5l9 9M14 5l-3 3M9 14l-3 3M5 5l1 4-4-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
    '<path d="M19 5l-9 9M10 14l3 3 3-3M19 5l-1 4 4-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  // Defend: shield (solid) — distinct from part-armor (which has a cross bar).
  defend: '<path d="M12 2 4 5v7c0 5 3.5 8 8 10 4.5-2 8-5 8-10V5z" fill="currentColor"/>',
  // Target: reticle.
  target:
    '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<circle cx="12" cy="12" r="2.5" fill="currentColor"/>' +
    '<path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" stroke-width="1.8"/>',
  // Timer: clock.
  timer:
    '<circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<path d="M12 9v4l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path d="M9 2h6" stroke="currentColor" stroke-width="1.8"/>',
  // Chevron: right-pointing (rotate via CSS for other directions).
  chevron:
    '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  // Close: X.
  close:
    '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  // Plus.
  plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  // Save: floppy/diskette.
  save:
    '<path d="M4 4h13l3 3v13H4z" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<path d="M8 4v5h7V4" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<rect x="8" y="13" width="8" height="6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  // Trash: bin with lid + handle.
  trash:
    '<path d="M4 7h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path d="M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<path d="M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.6"/>',
};

/**
 * Returns an inline <svg> string for the named glyph. Size defaults to 16px;
 * fill/stroke use currentColor so CSS `color` tints it. Pass `cls` to add a
 * class (e.g. for spacing or rotation).
 */
export function icon(name: IconName, opts: IconOpts = {}): string {
  const size = opts.size ?? 16;
  const cls = opts.cls ? ` class="${opts.cls}"` : '';
  return (
    `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    `fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${GLYPHS[name]}</svg>`
  );
}

/** Map a division name to its icon glyph. */
export function divisionIcon(division: 'infantry' | 'mechanized' | 'aerial' | 'bioform'): string {
  const map: Record<typeof division, IconName> = {
    infantry: 'div-infantry',
    mechanized: 'div-mechanized',
    aerial: 'div-aerial',
    bioform: 'div-bioform',
  };
  return icon(map[division]);
}

/** Map a part kind to its icon glyph. */
export function partIcon(
  kind: 'engine' | 'powerSupply' | 'computer' | 'sensor' | 'armor' | 'weapon' | 'misc',
): string {
  const map: Record<typeof kind, IconName> = {
    engine: 'part-engine',
    powerSupply: 'part-powerSupply',
    computer: 'part-computer',
    sensor: 'part-sensor',
    armor: 'part-armor',
    weapon: 'part-weapon',
    misc: 'part-misc',
  };
  return icon(map[kind]);
}
