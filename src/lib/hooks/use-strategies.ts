// ABOUTME: TanStack Query hooks for strategy CRUD and share/import operations.
// ABOUTME: Manages saved strategy configurations with 8-digit share codes.

'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useAuthQuery, useAuthMutation } from '@/lib/hooks/use-auth-query';

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
}

export interface Strategy {
  id: string;
  userId: string;
  name: string;
  shareCode: string;
  config: StrategyConfig;
  createdAt: string;
  updatedAt: string;
}

const STRATEGIES_KEY = ['strategies'] as const;

export function useStrategies() {
  return useAuthQuery<Strategy[]>(
    [...STRATEGIES_KEY],
    '/strategies',
  );
}

export function useCreateStrategy() {
  const queryClient = useQueryClient();
  return useAuthMutation<Strategy, { name: string; config: StrategyConfig }>(
    '/strategies',
    'POST',
    { onSettled: () => { void queryClient.invalidateQueries({ queryKey: STRATEGIES_KEY }); } },
  );
}

export function useDeleteStrategy(id: string) {
  const queryClient = useQueryClient();
  return useAuthMutation<void, void>(
    `/strategies/${id}`,
    'DELETE',
    { onSettled: () => { void queryClient.invalidateQueries({ queryKey: STRATEGIES_KEY }); } },
  );
}

export function useDuplicateStrategy() {
  const queryClient = useQueryClient();
  return useAuthMutation<Strategy, { name: string; config: StrategyConfig }>(
    '/strategies',
    'POST',
    { onSettled: () => { void queryClient.invalidateQueries({ queryKey: STRATEGIES_KEY }); } },
  );
}

export function useImportStrategy(code: string) {
  const queryClient = useQueryClient();
  return useAuthMutation<Strategy, void>(
    `/strategies/import/${code}`,
    'POST',
    { onSettled: () => { void queryClient.invalidateQueries({ queryKey: STRATEGIES_KEY }); } },
  );
}
