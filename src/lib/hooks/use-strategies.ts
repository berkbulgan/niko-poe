// ABOUTME: TanStack Query hooks for strategy CRUD operations.
// ABOUTME: config is serialized to/from JSON string at the hook boundary for SQLite storage.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Strategy } from '@/types/index';
import type { StrategyItem, StrategyConfig } from '@/types/strategies';
import * as ipc from '@/lib/ipc';
import { unpublishStrategy } from '@/lib/hooks/use-community';

export type { StrategyItem, StrategyConfig };

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

/** The strategies that link this filter preset or atlas tree. */
export function useStrategiesUsing(field: 'filterPresetId' | 'atlasTreeId', id: string): Array<{ id: string; name: string }> {
  const { data } = useStrategies();
  return data?.filter((s) => s.config[field] === id).map((s) => ({ id: s.id, name: s.name })) ?? [];
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

/** Unpublishes first so the community copy is not orphaned; if that fails the strategy is kept. */
export async function deleteStrategy(id: string): Promise<void> {
  try {
    await unpublishStrategy(id);
  } catch (err) {
    throw new Error(`Could not remove it from the community list, so it was not deleted: ${err instanceof Error ? err.message : String(err)}`);
  }
  await ipc.deleteStrategy(id);
}

export function useDeleteStrategy(id: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => deleteStrategy(id),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: STRATEGIES_KEY });
      void queryClient.invalidateQueries({ queryKey: ['community'] });
    },
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

