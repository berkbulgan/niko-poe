// ABOUTME: HTTP API client for communicating with the C.A.D.I.R.O. backend.
// ABOUTME: Provides typed get/post/patch/del methods with auth token injection and error handling.

import type { ApiError } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const TOKEN_KEY = 'cadiro_token';

export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly errorType: string;

  constructor(apiError: ApiError) {
    super(apiError.message);
    this.name = 'ApiClientError';
    this.statusCode = apiError.statusCode;
    this.errorType = apiError.error;
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

async function request<TResponse>(
  method: string,
  path: string,
  body?: unknown,
): Promise<TResponse> {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    clearToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new ApiClientError({
      statusCode: 401,
      message: 'Authentication required',
      error: 'Unauthorized',
    });
  }

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => ({
      statusCode: response.status,
      message: response.statusText,
      error: 'UnknownError',
    }));

    const apiError = errorBody as ApiError;
    throw new ApiClientError(apiError);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  const json: unknown = await response.json();

  // Backend wraps responses in { data, timestamp } envelope — unwrap it
  if (
    json !== null &&
    typeof json === 'object' &&
    'data' in json &&
    'timestamp' in json
  ) {
    return (json as { data: TResponse }).data;
  }

  return json as TResponse;
}

export const api = {
  get<TResponse>(path: string): Promise<TResponse> {
    return request<TResponse>('GET', path);
  },

  post<TResponse>(path: string, body?: unknown): Promise<TResponse> {
    return request<TResponse>('POST', path, body);
  },

  patch<TResponse>(path: string, body?: unknown): Promise<TResponse> {
    return request<TResponse>('PATCH', path, body);
  },

  del<TResponse>(path: string): Promise<TResponse> {
    return request<TResponse>('DELETE', path);
  },
};
