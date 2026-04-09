// ABOUTME: TanStack Query hooks for stash snapshot configs, snapshot capture, and retrieval.
// ABOUTME: Provides CRUD mutations for configs, take/delete snapshot mutations, and query hooks.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSnapshotConfigs,
  createSnapshotConfig,
  updateSnapshotConfig,
  deleteSnapshotConfig,
  takeSnapshot,
  getSnapshots,
  getSnapshotDetail,
  getRecentSnapshots,
  deleteSnapshot,
} from '@/lib/ipc';
import type {
  SnapshotConfig,
  CreateSnapshotConfigInput,
  UpdateSnapshotConfigInput,
  SnapshotSummary,
  StashSnapshot,
  RecentSnapshot,
  TakeSnapshotInput,
} from '@/types/snapshots';

const CONFIGS_KEY = ['snapshot-configs'] as const;
const SNAPSHOTS_KEY = ['snapshots'] as const;
const RECENT_KEY = ['recent-snapshots'] as const;
const DETAIL_KEY = ['snapshot-detail'] as const;

// ── Config hooks ────────────────────────────────────────────────────────────

export function useSnapshotConfigs() {
  return useQuery<SnapshotConfig[]>({
    queryKey: [...CONFIGS_KEY],
    queryFn: getSnapshotConfigs,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateSnapshotConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSnapshotConfigInput) => createSnapshotConfig(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONFIGS_KEY });
    },
  });
}

export function useUpdateSnapshotConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSnapshotConfigInput }) =>
      updateSnapshotConfig(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONFIGS_KEY });
    },
  });
}

export function useDeleteSnapshotConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSnapshotConfig(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONFIGS_KEY });
      void queryClient.invalidateQueries({ queryKey: RECENT_KEY });
    },
  });
}

// ── Snapshot hooks ──────────────────────────────────────────────────────────

export function useSnapshots(configId: string | null) {
  return useQuery<SnapshotSummary[]>({
    queryKey: [...SNAPSHOTS_KEY, configId],
    queryFn: () => getSnapshots(configId!),
    enabled: configId != null,
    staleTime: 30 * 1000,
  });
}

export function useSnapshotDetail(snapshotId: string | null) {
  return useQuery<StashSnapshot>({
    queryKey: [...DETAIL_KEY, snapshotId],
    queryFn: () => getSnapshotDetail(snapshotId!),
    enabled: snapshotId != null,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecentSnapshots() {
  return useQuery<RecentSnapshot[]>({
    queryKey: [...RECENT_KEY],
    queryFn: getRecentSnapshots,
    staleTime: 60 * 1000,
  });
}

export function useTakeSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TakeSnapshotInput) => takeSnapshot(input),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: [...SNAPSHOTS_KEY, data.configId] });
      void queryClient.invalidateQueries({ queryKey: RECENT_KEY });
    },
  });
}

export function useDeleteSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (snapshotId: string) => deleteSnapshot(snapshotId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SNAPSHOTS_KEY });
      void queryClient.invalidateQueries({ queryKey: RECENT_KEY });
    },
  });
}
