// ABOUTME: League selection context — fetches leagues from PoE API on mount.
// ABOUTME: Provides useLeague() hook for current league and league switching.

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from '@/lib/api';

interface League {
  id: string;
  text: string;
}

interface LeagueContextValue {
  leagues: League[];
  currentLeague: string;
  setLeague: (id: string) => void;
  isLoading: boolean;
}

const LeagueContext = createContext<LeagueContextValue | null>(null);

const LEAGUE_STORAGE_KEY = 'cadiro_league';

export function LeagueProvider({ children }: { children: React.ReactNode }) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [currentLeague, setCurrentLeague] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get<League[]>('/trade/leagues')
      .then((data) => {
        setLeagues(data);
        const stored = typeof window !== 'undefined'
          ? localStorage.getItem(LEAGUE_STORAGE_KEY)
          : null;
        // Use stored league if it exists in the list, otherwise first league
        const valid = stored && data.some((l) => l.id === stored);
        setCurrentLeague(valid ? stored : data[0]?.id ?? 'Standard');
      })
      .catch(() => {
        // Fallback if API fails
        setLeagues([
          { id: 'Standard', text: 'Standard' },
          { id: 'Settlers', text: 'Settlers' },
        ]);
        setCurrentLeague('Settlers');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const setLeague = useCallback((id: string) => {
    setCurrentLeague(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LEAGUE_STORAGE_KEY, id);
    }
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
