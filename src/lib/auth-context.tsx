// ABOUTME: Authentication context — GGG OAuth2 PKCE integration for Tauri.
// ABOUTME: App works fully when unauthenticated; login is optional for stash features.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/stores/toast-store';
import type { GggProfile, UserProfile } from '@/types';
import { getGggProfile, logoutGgg, startOAuthLogin } from '@/lib/ipc';

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function profileToUser(profile: GggProfile): UserProfile {
  return {
    id: profile.accountName,
    username: profile.accountName,
    displayName: profile.accountName,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  // On mount, check if a stored session exists.
  useEffect(() => {
    let cancelled = false;

    getGggProfile()
      .then((profile) => {
        if (cancelled) return;
        setUser(profile !== null ? profileToUser(profile) : null);
      })
      .catch(() => {
        // No stored session or command unavailable — continue unauthenticated.
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async () => {
    setIsLoading(true);
    try {
      await startOAuthLogin();
      const profile = await getGggProfile();
      setUser(profile !== null ? profileToUser(profile) : null);
      // Re-run stash queries that failed with the previous (expired) session.
      void queryClient.invalidateQueries({ queryKey: ['ggg-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['stash'] });
    } catch (err: unknown) {
      console.error('[auth] login failed:', err);
      toast.error(`Login failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, [queryClient]);

  const logout = useCallback(async () => {
    await logoutGgg();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: user !== null, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
