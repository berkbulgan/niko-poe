// ABOUTME: Static PoE map modifier data from the poe.re project (synced by scripts/sync-game-data.mjs).
// ABOUTME: Includes tokens, optimization table, and helpers for regex generation.

import rawMods from './map-mods-full.json';
import optimizationTableData from './optimization-table.json';
import modIdAliases from './mod-id-aliases.json';

export interface MapMod {
  id: number;
  regex: string;
  text: string;
  generalizedText: string;
  scary: number;
  isNightmare: boolean;
}

export interface TokenOptimization {
  ids: number[];
  regex: string;
  weight: number;
  count: number;
}

export const NIGHTMARE_THRESHOLD = 1001;

export const MAP_MODS: MapMod[] = rawMods.map((m) => ({
  id: m.id,
  regex: m.regex,
  text: m.rawText,
  generalizedText: m.generalizedText,
  scary: m.options.scary,
  isNightmare: m.options.nm ?? m.options.scary >= NIGHTMARE_THRESHOLD,
}));

export const OPTIMIZATION_TABLE = optimizationTableData as Record<string, TokenOptimization>;

const MOD_ID_ALIASES = modIdAliases as Record<string, number>;
const KNOWN_MOD_IDS = new Set(MAP_MODS.map((m) => m.id));

/**
 * Maps mod ids saved under older data to their current ids (upstream re-ids mods when their
 * text changes; scripts/sync-game-data.mjs records the aliases) and drops mods that no longer exist.
 */
export function resolveModIds(ids: number[]): number[] {
  const resolved = new Set<number>();
  for (let id of ids) {
    for (let hops = 0; !KNOWN_MOD_IDS.has(id) && MOD_ID_ALIASES[id] !== undefined && hops < 10; hops++) {
      id = MOD_ID_ALIASES[id];
    }
    if (KNOWN_MOD_IDS.has(id)) resolved.add(id);
  }
  return [...resolved];
}

export function isNightmare(mod: MapMod): boolean {
  return mod.isNightmare;
}
