// ABOUTME: PoE map modifier data: bundled from poe.re (scripts/sync-game-data.mjs), replaceable at runtime with
// ABOUTME: the N.I.K.O. server's data via applyMapModData. Includes tokens, optimization table and mod id aliases.

import rawMods from './map-mods-full.json';
import optimizationTableData from './optimization-table.json';
import modIdAliases from './mod-id-aliases.json';
import type { MapModData } from '@/types/game-data';

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

/** One token as poe.re publishes it. */
interface RawMapMod {
  id: number;
  regex: string;
  rawText: string;
  generalizedText: string;
  options: { scary: number; nm?: boolean };
}

export const NIGHTMARE_THRESHOLD = 1001;

function toMapMod(m: RawMapMod): MapMod {
  return {
    id: m.id,
    regex: m.regex,
    text: m.rawText,
    generalizedText: m.generalizedText,
    scary: m.options.scary,
    isNightmare: m.options.nm ?? m.options.scary >= NIGHTMARE_THRESHOLD,
  };
}

// Replaced by applyMapModData; importers read these live bindings at call time.
export let MAP_MODS: MapMod[] = (rawMods as RawMapMod[]).map(toMapMod);
export let OPTIMIZATION_TABLE = optimizationTableData as Record<string, TokenOptimization>;

const BUNDLED_ALIASES = modIdAliases as Record<string, number>;
let modIdAliasMap: Record<string, number> = BUNDLED_ALIASES;
let knownModIds = new Set(MAP_MODS.map((m) => m.id));

function isRawMapMod(token: unknown): token is RawMapMod {
  if (typeof token !== 'object' || token === null) return false;
  const t = token as Record<string, unknown>;
  const options = t.options as Record<string, unknown> | null | undefined;
  return (
    typeof t.id === 'number' &&
    typeof t.regex === 'string' &&
    typeof t.rawText === 'string' &&
    typeof t.generalizedText === 'string' &&
    typeof options === 'object' &&
    options !== null &&
    typeof options.scary === 'number'
  );
}

/**
 * Switches to map mod data from the N.I.K.O. server. Returns false and changes nothing when the shape is
 * invalid (or there are no tokens). Server aliases win over bundled ones for the same old id.
 */
export function applyMapModData(data: MapModData): boolean {
  const table = data.optimizationTable;
  if (
    !Array.isArray(data.tokens) ||
    data.tokens.length === 0 ||
    !data.tokens.every(isRawMapMod) ||
    typeof table !== 'object' ||
    table === null ||
    Array.isArray(table)
  ) {
    return false;
  }
  MAP_MODS = (data.tokens as RawMapMod[]).map(toMapMod);
  OPTIMIZATION_TABLE = table as Record<string, TokenOptimization>;
  modIdAliasMap = { ...BUNDLED_ALIASES, ...data.aliases };
  knownModIds = new Set(MAP_MODS.map((m) => m.id));
  return true;
}

/**
 * Maps mod ids saved under older data to their current ids (upstream re-ids mods when their text changes;
 * the bundled mod-id-aliases.json and the server record the aliases) and drops mods that no longer exist.
 * Aliases are only followed for unknown ids, so an identity alias (A → A) changes nothing.
 */
export function resolveModIds(ids: number[]): number[] {
  const resolved = new Set<number>();
  for (let id of ids) {
    for (let hops = 0; !knownModIds.has(id) && modIdAliasMap[id] !== undefined && hops < 10; hops++) {
      id = modIdAliasMap[id];
    }
    if (knownModIds.has(id)) resolved.add(id);
  }
  return [...resolved];
}

export function isNightmare(mod: MapMod): boolean {
  return mod.isNightmare;
}
