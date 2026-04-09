// ABOUTME: League selection context — provides current league and league switching.
// ABOUTME: Hardcoded to the 4 leagues supported by poe.ninja. Fetches prices on league change.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchAllPrices } from '@/lib/ipc';
import type { League } from '@/types/index';
import { storage } from '@/lib/platform';

interface LeagueContextValue {
  leagues: League[];
  currentLeague: string;
  setLeague: (id: string) => void;
  isLoading: boolean;
}

const LeagueContext = createContext<LeagueContextValue | null>(null);

const LEAGUE_STORAGE_KEY = 'niko_league';
const DEFAULT_LEAGUE = 'Mirage';

// poe.ninja only supports these 4 leagues — updated manually each league launch.
const LEAGUES: League[] = [
  { id: 'Mirage', text: 'Mirage' },
  { id: 'Hardcore Mirage', text: 'Hardcore Mirage' },
  { id: 'Standard', text: 'Standard' },
  { id: 'Hardcore', text: 'Hardcore' },
];

export function LeagueProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const [currentLeague, setCurrentLeague] = useState(() => {
    const stored = storage.get(LEAGUE_STORAGE_KEY);
    // Validate stored league is still in the list
    if (stored && LEAGUES.some((l) => l.id === stored)) {
      return stored;
    }
    return DEFAULT_LEAGUE;
  });

  // Fetch poe.ninja prices whenever the active league changes.
  useEffect(() => {
    if (currentLeague) {
      void fetchAllPrices(currentLeague).then(() => {
        void queryClient.invalidateQueries({ queryKey: ['prices'] });
        void queryClient.invalidateQueries({ queryKey: ['item-prices'] });
      });
    }
  }, [currentLeague, queryClient]);

  const setLeague = useCallback((id: string) => {
    setCurrentLeague(id);
    storage.set(LEAGUE_STORAGE_KEY, id);
  }, []);

  const value = useMemo<LeagueContextValue>(() => ({
    leagues: LEAGUES,
    currentLeague,
    setLeague,
    isLoading: false,
  }), [currentLeague, setLeague]);

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
