// ABOUTME: TanStack Query hooks for filter preset CRUD operations.
// ABOUTME: config is serialized to/from JSON string at the hook boundary for SQLite storage.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { FilterPreset } from '@/types/index';
import * as ipc from '@/lib/ipc';

export interface FilterPresetConfig {
  quantity: string;
  packSize: string;
  rarity: string;
  mapTier: string;
  quality: string;
  qualityType: string;
  moreCurrency: string;
  moreMaps: string;
  moreScarabs: string;
  moreDivination: string;
  corrupted: 'natural' | 'prefer' | 'avoid';
  isNightmareMap?: boolean;
  avoidModIds: number[];
  preferModIds: number[];
}

// Parsed view of a FilterPreset — config as an object instead of a JSON string.
export interface FilterPresetParsed extends Omit<FilterPreset, 'config'> {
  config: FilterPresetConfig;
}

// Re-export so pages can import FilterPreset from hook file
export type { FilterPreset };

function parsePreset(preset: FilterPreset): FilterPresetParsed {
  return { ...preset, config: JSON.parse(preset.config) as FilterPresetConfig };
}

const PRESETS_KEY = ['filter-presets'] as const;

export function useFilterPresets() {
  return useQuery<FilterPresetParsed[]>({
    queryKey: [...PRESETS_KEY],
    queryFn: async () => {
      const presets = await ipc.getFilterPresets();
      return presets.map(parsePreset);
    },
  });
}

export function useCreatePreset() {
  const queryClient = useQueryClient();
  return useMutation<FilterPresetParsed, Error, { name: string; config: FilterPresetConfig }>({
    mutationFn: async ({ name, config }) => {
      const preset = await ipc.createFilterPreset({ name, config: JSON.stringify(config) });
      return parsePreset(preset);
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: PRESETS_KEY }); },
  });
}

export function useDeletePreset(id: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => ipc.deleteFilterPreset(id),
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: PRESETS_KEY }); },
  });
}

export function useUpdatePreset(id: string) {
  const queryClient = useQueryClient();
  return useMutation<FilterPresetParsed, Error, Partial<{ name: string; config: FilterPresetConfig }>>({
    mutationFn: async ({ name, config }) => {
      const preset = await ipc.updateFilterPreset(id, {
        name,
        config: config !== undefined ? JSON.stringify(config) : undefined,
      });
      return parsePreset(preset);
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: PRESETS_KEY }); },
  });
}

export function useDuplicatePreset() {
  const queryClient = useQueryClient();
  return useMutation<FilterPresetParsed, Error, { name: string; config: FilterPresetConfig }>({
    mutationFn: async ({ name, config }) => {
      const preset = await ipc.createFilterPreset({ name, config: JSON.stringify(config) });
      return parsePreset(preset);
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: PRESETS_KEY }); },
  });
}

// Import by share code is a Phase 4 feature (requires GGG OAuth / server).
// Keeping the hook stub so call sites compile.
export function useImportPreset(_code: string) {
  const queryClient = useQueryClient();
  return useMutation<FilterPresetParsed, Error, void>({
    mutationFn: async () => { throw new Error('Import not yet implemented'); },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: PRESETS_KEY }); },
  });
}
