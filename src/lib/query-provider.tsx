// ABOUTME: TanStack React Query provider with sensible default configuration.
// ABOUTME: Sets staleTime, retry policy, and wraps children with QueryClientProvider.

import { useState } from 'react';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from '@/lib/stores/toast-store';

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Every failed save/delete/snapshot surfaces to the user; mutations that render
        // their own inline error opt out with `meta: { inlineError: true }`.
        mutationCache: new MutationCache({
          onError: (err, _vars, _ctx, mutation) => {
            if (mutation.meta?.inlineError) return;
            toast.error(err.message);
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
