// ABOUTME: Auth-aware wrappers around TanStack Query's useQuery and useMutation.
// ABOUTME: Automatically uses the API client so components never handle fetch logic directly.

'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
  type QueryKey,
} from '@tanstack/react-query';
import { api, type ApiClientError } from '@/lib/api';

export function useAuthQuery<TData>(
  queryKey: QueryKey,
  path: string,
  options?: Omit<UseQueryOptions<TData, ApiClientError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<TData, ApiClientError>({
    queryKey,
    queryFn: () => api.get<TData>(path),
    ...options,
  });
}

type HttpMethod = 'POST' | 'PATCH' | 'DELETE';

export function useAuthMutation<TData, TVariables = unknown>(
  path: string,
  method: HttpMethod = 'POST',
  options?: Omit<UseMutationOptions<TData, ApiClientError, TVariables>, 'mutationFn'>,
) {
  const queryClient = useQueryClient();

  return useMutation<TData, ApiClientError, TVariables>({
    mutationFn: (variables) => {
      switch (method) {
        case 'POST':
          return api.post<TData>(path, variables);
        case 'PATCH':
          return api.patch<TData>(path, variables);
        case 'DELETE':
          return api.del<TData>(path);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries();
    },
    ...options,
  });
}
