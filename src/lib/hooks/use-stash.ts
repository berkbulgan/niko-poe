// ABOUTME: TanStack Query hooks for GGG stash API — tab listing and item fetching.
// ABOUTME: Queries are gated on authentication; returns empty when user is not logged in.

import { useQuery } from '@tanstack/react-query';
import { getStashTabs, getStashTabContents } from '@/lib/ipc';
import { getGggProfile } from '@/lib/ipc';
import type { StashTab, StashItem } from '@/types/index';

const STASH_TABS_KEY = ['stash', 'tabs'] as const;
const STASH_CONTENTS_KEY = ['stash', 'contents'] as const;

/** Fetches the list of stash tabs for the given league.
 *  Only enabled when the user is authenticated (GGG profile present). */
export function useStashTabs(league: string) {
  const authQuery = useQuery({
    queryKey: ['ggg-profile'],
    queryFn: () => getGggProfile(),
    staleTime: 5 * 60 * 1000,
  });

  const isAuthenticated = authQuery.data != null;

  return useQuery<StashTab[]>({
    queryKey: [...STASH_TABS_KEY, league],
    queryFn: () => getStashTabs(league),
    enabled: isAuthenticated && league.length > 0,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
}

/** Fetches the items inside a specific stash tab.
 *  Only enabled when the user is authenticated and both league and stashId are provided. */
export function useStashContents(league: string, stashId: string) {
  const authQuery = useQuery({
    queryKey: ['ggg-profile'],
    queryFn: () => getGggProfile(),
    staleTime: 5 * 60 * 1000,
  });

  const isAuthenticated = authQuery.data != null;

  return useQuery<StashItem[]>({
    queryKey: [...STASH_CONTENTS_KEY, league, stashId],
    queryFn: () => getStashTabContents(league, stashId),
    enabled: isAuthenticated && league.length > 0 && stashId.length > 0,
    staleTime: 60 * 1000,
    retry: false,
  });
}
