// ABOUTME: TanStack Query hooks for filter preset CRUD and share/import operations.
// ABOUTME: Manages saved configurations with 8-digit share codes.

'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useAuthQuery, useAuthMutation } from '@/lib/hooks/use-auth-query';
import { api } from '@/lib/api';

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
  avoidModIds: number[];
  preferModIds: number[];
}

export interface FilterPreset {
  id: string;
  userId: string;
  name: string;
  shareCode: string;
  config: FilterPresetConfig;
  createdAt: string;
  updatedAt: string;
}

const PRESETS_KEY = ['filter-presets'] as const;

export function useFilterPresets() {
  return useAuthQuery<FilterPreset[]>(
    [...PRESETS_KEY],
    '/filter-presets',
  );
}

export function useCreatePreset() {
  const queryClient = useQueryClient();
  return useAuthMutation<FilterPreset, { name: string; config: FilterPresetConfig }>(
    '/filter-presets',
    'POST',
    { onSettled: () => { void queryClient.invalidateQueries({ queryKey: PRESETS_KEY }); } },
  );
}

export function useDeletePreset(id: string) {
  const queryClient = useQueryClient();
  return useAuthMutation<void, void>(
    `/filter-presets/${id}`,
    'DELETE',
    { onSettled: () => { void queryClient.invalidateQueries({ queryKey: PRESETS_KEY }); } },
  );
}

export function useImportPreset(code: string) {
  const queryClient = useQueryClient();
  return useAuthMutation<FilterPreset, void>(
    `/filter-presets/import/${code}`,
    'POST',
    { onSettled: () => { void queryClient.invalidateQueries({ queryKey: PRESETS_KEY }); } },
  );
}

export async function fetchPresetByCode(code: string): Promise<FilterPreset> {
  return api.get<FilterPreset>(`/filter-presets/share/${code}`);
}
