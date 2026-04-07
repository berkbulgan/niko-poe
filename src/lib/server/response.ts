// ABOUTME: Standardized API response helpers for Next.js route handlers.
// ABOUTME: Wraps data in { data, timestamp } envelope matching the existing backend format.

import { NextResponse } from 'next/server';
import { AuthError } from '@/lib/server/auth';

export function success<TData>(data: TData, status = 200): NextResponse {
  return NextResponse.json(
    { data, timestamp: new Date().toISOString() },
    { status },
  );
}

export function error(message: string | string[], status: number, errorType?: string): NextResponse {
  return NextResponse.json(
    {
      statusCode: status,
      message,
      error: errorType ?? getDefaultErrorType(status),
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}

export function paginated<TData>(
  data: TData[],
  total: number,
  page: number,
  limit: number,
): NextResponse {
  return NextResponse.json(
    {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}

function getDefaultErrorType(status: number): string {
  switch (status) {
    case 400: return 'Bad Request';
    case 401: return 'Unauthorized';
    case 403: return 'Forbidden';
    case 404: return 'Not Found';
    case 409: return 'Conflict';
    default: return 'Internal Server Error';
  }
}

/**
 * Route handler context type compatible with Next.js 15 dynamic route params.
 * Params are async in Next.js 15 — handlers must await context.params.
 */
interface RouteContext {
  params: Promise<Record<string, string>>;
}

/**
 * Wraps a route handler with standard error handling.
 * Catches AuthError, validation errors, and unexpected errors.
 */
export function withErrorHandler(
  handler: (request: Request, context: RouteContext) => Promise<NextResponse>,
) {
  return async (request: Request, context: RouteContext): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        return error(err.message, err.status);
      }
      if (err instanceof Error) {
        console.error(`[API Error] ${request.method} ${request.url}:`, err.message);
        return error('Internal server error', 500);
      }
      return error('Unknown error', 500);
    }
  };
}

/**
 * Generates a random 8-digit numeric share code.
 */
export function generateShareCode(): string {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}
