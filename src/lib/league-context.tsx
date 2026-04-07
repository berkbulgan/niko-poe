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
    let cancelled = false;

    async function fetchLeagues() {
      // Try up to 3 times with 2s delay (backend might still be starting)
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const data = await api.get<League[]>('/trade/leagues');
          if (cancelled) return;
          if (Array.isArray(data) && data.length > 0) {
            setLeagues(data);
            const stored = typeof window !== 'undefined'
              ? localStorage.getItem(LEAGUE_STORAGE_KEY)
              : null;
            const valid = stored && data.some((l) => l.id === stored);
            setCurrentLeague(valid ? stored : data[0].id);
            setIsLoading(false);
            return;
          }
        } catch {
          if (cancelled) return;
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
      }

      // All retries failed — use fallback
      if (!cancelled) {
        setLeagues([{ id: 'Standard', text: 'Standard' }]);
        setCurrentLeague('Standard');
        setIsLoading(false);
      }
    }

    void fetchLeagues();
    return () => { cancelled = true; };
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
