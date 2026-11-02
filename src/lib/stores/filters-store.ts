// ABOUTME: Zustand store for Filters page — persists active preset selection and StatPicker draft state across navigation.
// ABOUTME: Replaces local useState + forwardRef pattern so state survives page unmount/remount.

import { create } from 'zustand';
import type { FilterPresetConfig, MapStatFilters, QualityType } from '@/types/filters';
import { resolveModIds } from '@/data';

const EMPTY_FILTERS: MapStatFilters = {
  quantity: '',
  packSize: '',
  rarity: '',
  mapTier: '16',
  quality: '',
  qualityType: 'pack_size',
  moreCurrency: '',
  moreMaps: '',
  moreScarabs: '',
  moreDivination: '',
  corrupted: 'natural',
};

interface FiltersState {
  // Page-level selection
  activePresetId: string | null;

  // StatPicker draft state
  avoidIds: Set<number>;
  preferIds: Set<number>;
  filters: MapStatFilters;
  isNightmareMap: boolean;
  showNightmare: boolean;
  searchQuery: string;

  // Actions
  setActivePresetId: (id: string | null) => void;
  setAvoidIds: (ids: Set<number>) => void;
  setPreferIds: (ids: Set<number>) => void;
  setFilters: (filters: MapStatFilters) => void;
  updateFilter: (key: keyof MapStatFilters, value: string) => void;
  setIsNightmareMap: (value: boolean) => void;
  setShowNightmare: (value: boolean) => void;
  setSearchQuery: (query: string) => void;
  toggleAvoid: (id: number) => void;
  togglePrefer: (id: number) => void;
  clearAll: () => void;

  // Config get/load (replaces imperative handle)
  getConfig: () => FilterPresetConfig;
  loadConfig: (config: FilterPresetConfig) => void;
}

export const useFiltersStore = create<FiltersState>((set, get) => ({
  activePresetId: null,
  avoidIds: new Set(),
  preferIds: new Set(),
  filters: { ...EMPTY_FILTERS },
  isNightmareMap: false,
  showNightmare: false,
  searchQuery: '',

  setActivePresetId: (id) => set({ activePresetId: id }),

  setAvoidIds: (ids) => set({ avoidIds: ids }),
  setPreferIds: (ids) => set({ preferIds: ids }),
  setFilters: (filters) => set({ filters }),
  updateFilter: (key, value) => set((state) => ({
    filters: { ...state.filters, [key]: value },
  })),
  setIsNightmareMap: (value) => set({ isNightmareMap: value }),
  setShowNightmare: (value) => set({ showNightmare: value }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  toggleAvoid: (id) => set((state) => {
    const next = new Set(state.avoidIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      const nextPrefer = new Set(state.preferIds);
      nextPrefer.delete(id);
      return { avoidIds: next, preferIds: nextPrefer };
    }
    return { avoidIds: next };
  }),

  togglePrefer: (id) => set((state) => {
    const next = new Set(state.preferIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      const nextAvoid = new Set(state.avoidIds);
      nextAvoid.delete(id);
      return { preferIds: next, avoidIds: nextAvoid };
    }
    return { preferIds: next };
  }),

  clearAll: () => set({
    avoidIds: new Set(),
    preferIds: new Set(),
    filters: { ...EMPTY_FILTERS },
    isNightmareMap: false,
  }),

  getConfig: () => {
    const state = get();
    return {
      ...state.filters,
      isNightmareMap: state.isNightmareMap,
      avoidModIds: Array.from(state.avoidIds),
      preferModIds: Array.from(state.preferIds),
    };
  },

  loadConfig: (config) => set({
    filters: {
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
    },
    isNightmareMap: config.isNightmareMap ?? false,
    avoidIds: new Set(resolveModIds(config.avoidModIds ?? [])),
    preferIds: new Set(resolveModIds(config.preferModIds ?? [])),
  }),
}));

// Re-export types for consumers
export type { MapStatFilters, QualityType } from '@/types/filters';
export { EMPTY_FILTERS };
