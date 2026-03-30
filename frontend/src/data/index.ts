// ABOUTME: Static PoE map modifier data from poe-vendor-string project.
// ABOUTME: Includes tokens, optimization table, and helpers for regex generation.

import rawMods from './map-mods-full.json';
import optimizationTableData from './optimization-table.json';

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

export function isNightmare(mod: MapMod): boolean {
  return mod.isNightmare;
}
