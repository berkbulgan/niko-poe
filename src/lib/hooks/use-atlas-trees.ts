// ABOUTME: TanStack Query hooks for atlas tree CRUD operations.
// ABOUTME: config is serialized to/from JSON string at the hook boundary for SQLite storage.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AtlasTreeConfig } from '@/types/atlas-tree';
import type { AtlasTreeRecord } from '@/types/index';
import * as ipc from '@/lib/ipc';

// Parsed view of an AtlasTreeRecord — config as an object instead of a JSON string.
export interface AtlasTreeParsed extends Omit<AtlasTreeRecord, 'config'> {
  config: AtlasTreeConfig;
}

function parseAtlasTree(record: AtlasTreeRecord): AtlasTreeParsed {
  return { ...record, config: JSON.parse(record.config) as AtlasTreeConfig };
}

const ATLAS_TREES_KEY = ['atlas-trees'] as const;

export function useAtlasTrees() {
  return useQuery<AtlasTreeParsed[]>({
    queryKey: [...ATLAS_TREES_KEY],
    queryFn: async () => {
      const trees = await ipc.getAtlasTrees();
      return trees.map(parseAtlasTree);
    },
  });
}

export function useCreateAtlasTree() {
  const queryClient = useQueryClient();
  return useMutation<AtlasTreeParsed, Error, { name: string; config: AtlasTreeConfig }>({
    mutationFn: async ({ name, config }) => {
      const record = await ipc.createAtlasTree({ name, config: JSON.stringify(config) });
      return parseAtlasTree(record);
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: ATLAS_TREES_KEY }); },
  });
}

export function useDeleteAtlasTree(id: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => ipc.deleteAtlasTree(id),
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: ATLAS_TREES_KEY }); },
  });
}

export function useDuplicateAtlasTree() {
  const queryClient = useQueryClient();
  return useMutation<AtlasTreeParsed, Error, { name: string; config: AtlasTreeConfig }>({
    mutationFn: async ({ name, config }) => {
      const record = await ipc.createAtlasTree({ name, config: JSON.stringify(config) });
      return parseAtlasTree(record);
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: ATLAS_TREES_KEY }); },
  });
}

