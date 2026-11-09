// ABOUTME: League selection context — provides current league and league switching.
// ABOUTME: Leagues come from poe.ninja (a built-in list until it answers or if it fails). Fetches prices on league change.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAllPrices, getPriceLeagues } from '@/lib/ipc';
import type { League } from '@/types/index';
import { storage } from '@/lib/platform';

interface LeagueContextValue {
  leagues: League[];
  currentLeague: string;
  setLeague: (id: string) => void;
  /** True while poe.ninja prices are being fetched for the current league. */
  pricesLoading: boolean;
}

const LeagueContext = createContext<LeagueContextValue | null>(null);

const LEAGUE_STORAGE_KEY = 'niko_league';

// Used until poe.ninja's league list arrives, or when it can't be reached. First entry is the default.
const FALLBACK_LEAGUES: League[] = [
  { id: 'Allflame', text: 'Allflame' },
  { id: 'Hardcore Allflame', text: 'Hardcore Allflame' },
  { id: 'Standard', text: 'Standard' },
  { id: 'Hardcore', text: 'Hardcore' },
];

/** The selected league for windows without LeagueProvider (the overlay); the default league until one is picked. */
export function storedLeagueId(): string {
  return storage.get(LEAGUE_STORAGE_KEY) ?? FALLBACK_LEAGUES[0].id;
}

export function LeagueProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [pricesLoading, setPricesLoading] = useState(true);

  const { data: ninjaLeagues, isPending: leaguesPending } = useQuery({
    queryKey: ['price-leagues'],
    queryFn: getPriceLeagues,
    staleTime: Infinity,
    retry: 1,
  });
  const leagues = ninjaLeagues?.length ? ninjaLeagues : FALLBACK_LEAGUES;

  // A stored league that poe.ninja no longer lists (e.g. last league) falls back to the current one.
  const [storedLeague, setStoredLeague] = useState(() => storage.get(LEAGUE_STORAGE_KEY));
  const currentLeague = storedLeague && leagues.some((l) => l.id === storedLeague) ? storedLeague : leagues[0].id;

  // Fetch poe.ninja prices whenever the active league changes.
  // Sets pricesLoading=true before fetch, false after + invalidates queries.
  // Waits for the league list so a stale built-in list never triggers a fetch for the wrong league.
  useEffect(() => {
    if (leaguesPending) return;

    let cancelled = false;
    setPricesLoading(true);

    fetchAllPrices(currentLeague)
      .then(() => {
        if (cancelled) return;
        void queryClient.invalidateQueries({ queryKey: ['prices'] });
        void queryClient.invalidateQueries({ queryKey: ['item-prices'] });
      })
      .catch(() => {
        // Price fetch failed — continue without prices
      })
      .finally(() => {
        if (!cancelled) setPricesLoading(false);
      });

    return () => { cancelled = true; };
  }, [currentLeague, leaguesPending, queryClient]);

  const setLeague = useCallback((id: string) => {
    setStoredLeague(id);
    storage.set(LEAGUE_STORAGE_KEY, id);
  }, []);

  const value = useMemo<LeagueContextValue>(() => ({
    leagues,
    currentLeague,
    setLeague,
    pricesLoading,
  }), [leagues, currentLeague, setLeague, pricesLoading]);

  return (
    <LeagueContext.Provider value={value}>
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague(): LeagueContextValue {
  const ctx = useContext(LeagueContext);
  if (ctx === null) {
    throw new Error('useLeague must be used within LeagueProvider');
  }
  return ctx;
}
