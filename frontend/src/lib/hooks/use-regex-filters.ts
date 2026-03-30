// ABOUTME: TanStack Query hooks for CRUD operations on regex filters.
// ABOUTME: Wraps auth-aware query/mutation helpers for the /regex-filters API endpoints.

'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useAuthQuery, useAuthMutation } from '@/lib/hooks/use-auth-query';
import type {
  RegexFilter,
  CreateRegexFilterRequest,
  UpdateRegexFilterRequest,
  RegexTestRequest,
  RegexTestResponse,
  PaginatedResponse,
} from '@/types';

const FILTERS_KEY = ['regex-filters'] as const;

export function useRegexFilters(page = 1, limit = 20) {
  return useAuthQuery<PaginatedResponse<RegexFilter>>(
    [...FILTERS_KEY, { page, limit }],
    `/regex-filters?page=${page}&limit=${limit}`,
  );
}

export function useRegexFilter(id: string) {
  return useAuthQuery<RegexFilter>(
    [...FILTERS_KEY, id],
    `/regex-filters/${id}`,
    { enabled: id.length > 0 },
  );
}

export function useCreateFilter() {
  const queryClient = useQueryClient();

  return useAuthMutation<RegexFilter, CreateRegexFilterRequest>(
    '/regex-filters',
    'POST',
    {
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: FILTERS_KEY });
      },
    },
  );
}

export function useUpdateFilter(id: string) {
  const queryClient = useQueryClient();

  return useAuthMutation<RegexFilter, UpdateRegexFilterRequest>(
    `/regex-filters/${id}`,
    'PATCH',
    {
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: FILTERS_KEY });
      },
    },
  );
}

export function useDeleteFilter(id: string) {
  const queryClient = useQueryClient();

  return useAuthMutation<void, void>(
    `/regex-filters/${id}`,
    'DELETE',
    {
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: FILTERS_KEY });
      },
    },
  );
}

export function useTestRegex() {
  return useAuthMutation<RegexTestResponse, RegexTestRequest>(
    '/regex-filters/test',
    'POST',
  );
}
