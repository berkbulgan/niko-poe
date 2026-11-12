// ABOUTME: Pure helpers for Filters autosave: the "Untitled preset" name, empty-draft and config equality checks.
// ABOUTME: Kept free of React so they can be unit tested; used by use-entity-autosave and use-filters-autosave.

import { EMPTY_FILTERS } from '@/lib/stores/filters-store';
import type { FilterPresetConfig } from '@/types/filters';

/** `base`, or "`base` N" with the smallest N >= 2 not already used. */
export function untitledName(existingNames: string[], base = 'Untitled preset'): string {
  const taken = new Set(existingNames);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    if (!taken.has(`${base} ${n}`)) return `${base} ${n}`;
  }
}

/** Key-order-independent JSON form, so configs saved in another key order still compare equal. */
function normalize(config: FilterPresetConfig): string {
  return JSON.stringify(config, Object.keys(config).sort());
}

export function configsEqual(a: FilterPresetConfig | null, b: FilterPresetConfig | null): boolean {
  if (a === null || b === null) return a === b;
  return normalize(a) === normalize(b);
}

/** True for the config clearAll() produces, i.e. a draft the user has not touched. */
export function isEmptyConfig(config: FilterPresetConfig): boolean {
  return configsEqual(config, { ...EMPTY_FILTERS, isNightmareMap: false, avoidModIds: [], preferModIds: [] });
}
