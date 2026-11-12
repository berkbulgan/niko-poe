// ABOUTME: Builds the in-game stash search regex for a filter preset config.
// ABOUTME: Shared by the Filters stat picker and the community preset preview.

import { MAP_MODS, resolveModIds } from '@/data';
import { generateNumberRegex } from '@/lib/generate-number-regex';
import { buildOptimizedVendorRegex } from '@/lib/optimize-regex';
import type { FilterPresetConfig, MapStatFilters, QualityType } from '@/types/filters';

// In-game stash search regex keywords — sourced from poe-vendor-string (OptimizedMapOutput.ts)
const STASH_REGEX_MAP = {
  quantity: 'm q',       // "Ite**m Q**uantity"
  packSize: 'iz',        // "Pack S**iz**e"
  rarity: 'm rar',       // "Ite**m Rar**ity"
  moreCurrency: 'urr',   // "C**urr**ency"
  moreMaps: 're maps',   // "Mo**re Maps**"
  moreScarabs: 'sca',    // "**Sca**rab"
  moreDivination: 'div', // "**Div**ination"
} as const;

// Quality type → stash regex keyword
const QUALITY_REGEX_MAP: Record<QualityType, string> = {
  pack_size: 'ze\\).*',   // "Pack Si**ze)**"
  rarity: 'ty\\).*',      // "Rari**ty)**"
  currency: 'urr.*',      // "C**urr**ency"
  scarabs: 'sca.*',       // "**Sca**rab"
  cards: 'div.*',         // "**Div**ination"
};

function buildStatParts(filters: MapStatFilters): string[] {
  const parts: string[] = [];

  // Basic numeric filters (quantity, packSize, rarity)
  const basicKeys = ['quantity', 'packSize', 'rarity'] as const;
  for (const key of basicKeys) {
    const value = filters[key];
    if (!value) continue;
    const numRegex = generateNumberRegex(value, false);
    if (!numRegex) continue;
    parts.push(`"${STASH_REGEX_MAP[key]}.*${numRegex}%"`);
  }

  // "More X drops" filters
  const moreKeys = ['moreCurrency', 'moreMaps', 'moreScarabs', 'moreDivination'] as const;
  for (const key of moreKeys) {
    const value = filters[key];
    if (!value) continue;
    const numRegex = generateNumberRegex(value, false);
    if (!numRegex) continue;
    parts.push(`"${STASH_REGEX_MAP[key]}.*${numRegex}%"`);
  }

  // Quality filter with type-specific regex
  if (filters.quality) {
    const numRegex = generateNumberRegex(filters.quality, false);
    if (numRegex) {
      const qualityKeyword = QUALITY_REGEX_MAP[filters.qualityType];
      parts.push(`"${qualityKeyword}${numRegex}%"`);
    }
  }

  // Corrupted: "pte" matches "Corrupted", "!pte" matches non-corrupted
  if (filters.corrupted === 'prefer') {
    parts.push('"pte"');
  } else if (filters.corrupted === 'avoid') {
    parts.push('"!pte"');
  }

  return parts;
}

/** Same defaults as filters-store loadConfig, so configs saved without a field still work. */
function toFilters(config: FilterPresetConfig): MapStatFilters {
  return {
    quantity: config.quantity ?? '',
    packSize: config.packSize ?? '',
    rarity: config.rarity ?? '',
    mapTier: config.mapTier ?? '',
    quality: config.quality ?? '',
    qualityType: (config.qualityType as QualityType) ?? 'pack_size',
    moreCurrency: config.moreCurrency ?? '',
    moreMaps: config.moreMaps ?? '',
    moreScarabs: config.moreScarabs ?? '',
    moreDivination: config.moreDivination ?? '',
    corrupted: config.corrupted ?? 'natural',
  };
}

/** True when something in the config affects the regex (map tier is a trade-only field). */
export function hasRegexFilter(config: FilterPresetConfig): boolean {
  const f = toFilters(config);
  return (config.avoidModIds?.length ?? 0) > 0 || (config.preferModIds?.length ?? 0) > 0 ||
    f.corrupted !== 'natural' ||
    f.quantity !== '' || f.packSize !== '' || f.rarity !== '' || f.quality !== '' ||
    f.moreCurrency !== '' || f.moreMaps !== '' || f.moreScarabs !== '' || f.moreDivination !== '';
}

/** The stash search regex for a preset, or '' when nothing in it affects the regex. */
export function presetRegex(config: FilterPresetConfig): string {
  if (!hasRegexFilter(config)) return '';
  const avoidIds = new Set(resolveModIds(config.avoidModIds ?? []));
  const preferIds = new Set(resolveModIds(config.preferModIds ?? []));
  return buildOptimizedVendorRegex(
    MAP_MODS.filter((m) => avoidIds.has(m.id)),
    MAP_MODS.filter((m) => preferIds.has(m.id)),
    buildStatParts(toFilters(config)),
  );
}
