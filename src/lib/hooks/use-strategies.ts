// ABOUTME: TanStack Query hooks for strategy CRUD operations.
// ABOUTME: config is serialized to/from JSON string at the hook boundary for SQLite storage.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Strategy } from '@/types/index';
import * as ipc from '@/lib/ipc';

export interface StrategyItem {
  itemId: number;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  icon: string;
  mapsPerUse?: number;
}

export interface StrategyConfig {
  items: StrategyItem[];
  averageMapCost: number;
  mapCount: number;
  filterPresetId: string | null;
  atlasTreeId: string | null;
}

// Parsed view of a Strategy — config as an object instead of a JSON string.
export interface StrategyParsed extends Omit<Strategy, 'config'> {
  config: StrategyConfig;
}

function parseStrategy(strategy: Strategy): StrategyParsed {
  return { ...strategy, config: JSON.parse(strategy.config) as StrategyConfig };
}

const STRATEGIES_KEY = ['strategies'] as const;

export function useStrategies() {
  return useQuery<StrategyParsed[]>({
    queryKey: [...STRATEGIES_KEY],
    queryFn: async () => {
      const strategies = await ipc.getStrategies();
      return strategies.map(parseStrategy);
    },
  });
}

export function useCreateStrategy() {
  const queryClient = useQueryClient();
  return useMutation<StrategyParsed, Error, { name: string; config: StrategyConfig }>({
    mutationFn: async ({ name, config }) => {
      const strategy = await ipc.createStrategy({ name, config: JSON.stringify(config) });
      return parseStrategy(strategy);
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: STRATEGIES_KEY }); },
  });
}

export function useDeleteStrategy(id: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => ipc.deleteStrategy(id),
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: STRATEGIES_KEY }); },
  });
}

export function useDuplicateStrategy() {
  const queryClient = useQueryClient();
  return useMutation<StrategyParsed, Error, { name: string; config: StrategyConfig }>({
    mutationFn: async ({ name, config }) => {
      const strategy = await ipc.createStrategy({ name, config: JSON.stringify(config) });
      return parseStrategy(strategy);
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: STRATEGIES_KEY }); },
  });
}

// Import by share code is a Phase 4 feature (requires GGG OAuth / server).
// Keeping the hook stub so call sites compile.
export function useImportStrategy(_code: string) {
  const queryClient = useQueryClient();
  return useMutation<StrategyParsed, Error, void>({
    mutationFn: async () => { throw new Error('Import not yet implemented'); },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: STRATEGIES_KEY }); },
  });
}
