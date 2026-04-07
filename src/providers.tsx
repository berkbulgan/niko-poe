// ABOUTME: Root provider composition — wraps the app with global context providers.
// ABOUTME: Order matters: QueryProvider must wrap everything; Auth wraps League.

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
