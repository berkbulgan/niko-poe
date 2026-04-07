// ABOUTME: TanStack Query hooks for atlas tree CRUD and share/import operations.
// ABOUTME: Manages saved atlas tree builds with 8-digit share codes.

'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useAuthQuery, useAuthMutation } from '@/lib/hooks/use-auth-query';
import type { AtlasTree, AtlasTreeConfig } from '@/types/atlas-tree';

const ATLAS_TREES_KEY = ['atlas-trees'] as const;

export function useAtlasTrees() {
  return useAuthQuery<AtlasTree[]>(
    [...ATLAS_TREES_KEY],
    '/atlas-trees',
  );
}

export function useCreateAtlasTree() {
  const queryClient = useQueryClient();
  return useAuthMutation<AtlasTree, { name: string; config: AtlasTreeConfig }>(
    '/atlas-trees',
    'POST',
    { onSettled: () => { void queryClient.invalidateQueries({ queryKey: ATLAS_TREES_KEY }); } },
  );
}

export function useDeleteAtlasTree(id: string) {
  const queryClient = useQueryClient();
  return useAuthMutation<void, void>(
    `/atlas-trees/${id}`,
    'DELETE',
    { onSettled: () => { void queryClient.invalidateQueries({ queryKey: ATLAS_TREES_KEY }); } },
  );
}

export function useDuplicateAtlasTree() {
  const queryClient = useQueryClient();
  return useAuthMutation<AtlasTree, { name: string; config: AtlasTreeConfig }>(
    '/atlas-trees',
    'POST',
    { onSettled: () => { void queryClient.invalidateQueries({ queryKey: ATLAS_TREES_KEY }); } },
  );
}

export function useImportAtlasTree(code: string) {
  const queryClient = useQueryClient();
  return useAuthMutation<AtlasTree, void>(
    `/atlas-trees/import/${code}`,
    'POST',
    { onSettled: () => { void queryClient.invalidateQueries({ queryKey: ATLAS_TREES_KEY }); } },
  );
}
