// ABOUTME: Client-side providers wrapper for the root layout.
// ABOUTME: Bundles QueryProvider, AuthProvider, and LeagueProvider to keep root layout as Server Component.

'use client';

import { QueryProvider } from '@/lib/query-provider';
import { AuthProvider } from '@/lib/auth-context';
import { LeagueProvider } from '@/lib/league-context';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      <AuthProvider>
        <LeagueProvider>
          {children}
        </LeagueProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
