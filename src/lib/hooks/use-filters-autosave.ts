// ABOUTME: Autosaves the Regex Filters draft through useEntityAutosave: updates the open preset 500 ms after the
// ABOUTME: last change, or creates an "Untitled preset" on the first change when none is open.

import * as ipc from '@/lib/ipc';
import { useFiltersStore } from '@/lib/stores/filters-store';
import { configsEqual, isEmptyConfig } from '@/lib/filters-autosave';
import { useEntityAutosave, type AutosaveAdapter } from '@/lib/hooks/use-entity-autosave';
import type { FilterPresetConfig } from '@/types/filters';

export type { AutosaveStatus } from '@/lib/hooks/use-entity-autosave';

const filtersAdapter: AutosaveAdapter<FilterPresetConfig> = {
  subscribe: (listener) => useFiltersStore.subscribe(listener),
  getActiveId: () => useFiltersStore.getState().activePresetId,
  setActiveId: (id) => useFiltersStore.getState().setActivePresetId(id),
  getConfig: () => useFiltersStore.getState().getConfig(),
  loadConfig: (config) => useFiltersStore.getState().loadConfig(config),
  clear: () => useFiltersStore.getState().clearAll(),
  equal: configsEqual,
  isEmpty: isEmptyConfig,
  create: (name, config) => ipc.createFilterPreset({ name, config: JSON.stringify(config) }),
  update: async (id, config) => { await ipc.updateFilterPreset(id, { config: JSON.stringify(config) }); },
  untitledBase: 'Untitled preset',
  queryKey: ['filter-presets'],
  errorMessage: 'Could not save preset',
  logTag: '[Filters]',
};

export function useFiltersAutosave(presetNames: string[]) {
  return useEntityAutosave(filtersAdapter, presetNames);
}
