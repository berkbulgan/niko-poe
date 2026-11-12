// ABOUTME: TanStack Query hooks for the community strategies server.
// ABOUTME: Edit tokens and favourites are kept locally via community-storage.

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import * as ipc from '@/lib/ipc';
import {
  getPublished,
  setFavourited,
  setPublished,
} from '@/lib/community-storage';
import { strategyHash } from '@/lib/result-sharing';
import type { StrategyConfig } from '@/types/strategies';
import type { ListQuery, PublishRequest } from '@/types/community';

const COMMUNITY_KEY = ['community'] as const;

const SERVER_URL_KEY = ['community-url'] as const;

/** The server copy was deleted (e.g. by a moderator), so the local edit token is useless. */
function isGone(err: unknown): boolean {
  return err instanceof Error && /not found/i.test(err.message);
}

/** Returns the built-in community server URL, or null when this build has none. */
export function useCommunityServerUrl() {
  return useQuery<string | null>({
    queryKey: SERVER_URL_KEY,
    queryFn: () => ipc.setCommunityBaseUrl(null),
    staleTime: Infinity,
  });
}

const PAGE_SIZE = 20;

/** Pages of 20; the next page loads while fewer than `total` items are loaded. */
export function useCommunityList(query: Omit<ListQuery, 'page' | 'limit'>, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...COMMUNITY_KEY, 'list', query],
    queryFn: ({ pageParam }) => ipc.communityList({ ...query, page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0);
      // An empty page means the list shrank while scrolling; stop instead of asking forever.
      return last.items.length > 0 && loaded < last.total ? pages.length + 1 : undefined;
    },
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useCommunityStrategy(id: string | null) {
  return useQuery({
    queryKey: [...COMMUNITY_KEY, 'detail', id],
    queryFn: () => ipc.communityGet(id!),
    enabled: id !== null,
  });
}

/**
 * Details for a list of ids (my published, favourites), sharing the detail cache. Deleted ids are dropped;
 * `error` is the first other failure (e.g. server down), so the page can say so instead of showing an empty list.
 */
export function useCommunityStrategies(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: [...COMMUNITY_KEY, 'detail', id],
      queryFn: () => ipc.communityGet(id),
    })),
    combine: (results) => ({
      items: results.flatMap((r) => (r.data ? [r.data] : [])),
      isLoading: results.some((r) => r.isLoading),
      error: results.find((r) => r.error && !isGone(r.error))?.error ?? null,
    }),
  });
}

export function useCommunityTags(league: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...COMMUNITY_KEY, 'tags', league],
    queryFn: () => ipc.communityTags(league),
    enabled,
  });
}

/** Publishes a local strategy, or updates it when this install published it before. Returns the community id. */
export function useSavePublished() {
  const queryClient = useQueryClient();
  return useMutation<string, Error, { strategyId: string; config: StrategyConfig; request: PublishRequest }>({
    meta: { inlineError: true },
    mutationFn: async ({ strategyId, config, request }) => {
      const hash = await strategyHash(config);
      const existing = getPublished(strategyId);
      if (existing) {
        try {
          await ipc.communityUpdate(existing.communityId, existing.token, request);
          setPublished(strategyId, { ...existing, hash });
          return existing.communityId;
        } catch (err) {
          if (!isGone(err)) throw err;
        }
      }
      const created = await ipc.communityPublish(request);
      setPublished(strategyId, { communityId: created.id, token: created.editToken, hash });
      return created.id;
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: COMMUNITY_KEY }); },
  });
}

export function useUnpublish() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (strategyId) => {
      const existing = getPublished(strategyId);
      if (!existing) return;
      try {
        await ipc.communityDelete(existing.communityId, existing.token);
      } catch (err) {
        if (!isGone(err)) throw err;
      }
      setPublished(strategyId, null);
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: COMMUNITY_KEY }); },
  });
}

export function useToggleFavourite() {
  const queryClient = useQueryClient();
  return useMutation<number, Error, { id: string; on: boolean }>({
    mutationFn: async ({ id, on }) => {
      const { favouriteCount } = await ipc.communityFavourite(id, on);
      setFavourited(id, on);
      return favouriteCount;
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: COMMUNITY_KEY }); },
  });
}

export function useReportStrategy() {
  return useMutation<void, Error, { id: string; reason: string }>({
    mutationFn: ({ id, reason }) => ipc.communityReport(id, reason),
  });
}
