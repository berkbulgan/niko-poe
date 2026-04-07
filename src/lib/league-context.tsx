// ABOUTME: League selection context — provides current league and league switching.
// ABOUTME: Phase 3 replaces the hardcoded list with an ipc.getLeagues() call.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLeagues } from '@/lib/ipc';
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

// Fallback used when the IPC call fails or returns an empty list.
const DEFAULT_LEAGUE = 'Mirage';

const FALLBACK_LEAGUES: League[] = [
  { id: 'Mirage', text: 'Mirage' },
  { id: 'Standard', text: 'Standard' },
];

const ONE_HOUR = 60 * 60 * 1000;

export function LeagueProvider({ children }: { children: React.ReactNode }) {
  const { data: fetchedLeagues, isLoading } = useQuery<League[]>({
    queryKey: ['leagues'],
    queryFn: () => getLeagues(),
    staleTime: ONE_HOUR,
  });

  const leagues = (fetchedLeagues && fetchedLeagues.length > 0)
    ? fetchedLeagues
    : FALLBACK_LEAGUES;

  const [currentLeague, setCurrentLeague] = useState(() => {
    return storage.get(LEAGUE_STORAGE_KEY) ?? DEFAULT_LEAGUE;
  });

  // When the league list loads, validate the stored selection against it.
  useEffect(() => {
    if (leagues.length > 0 && !leagues.some((l) => l.id === currentLeague)) {
      setCurrentLeague(leagues[0].id);
    }
  }, [leagues, currentLeague]);

  const setLeague = useCallback((id: string) => {
    setCurrentLeague(id);
    storage.set(LEAGUE_STORAGE_KEY, id);
  }, []);

  const value = useMemo<LeagueContextValue>(() => ({
    leagues,
    currentLeague,
    setLeague,
    isLoading,
  }), [leagues, currentLeague, setLeague, isLoading]);

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
