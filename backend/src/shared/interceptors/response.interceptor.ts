// ABOUTME: Global response interceptor that wraps successful responses.
// Adds a consistent envelope format: { data, timestamp }.

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

interface WrappedResponse<TData> {
  data: TData;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor<TData>
  implements NestInterceptor<TData, WrappedResponse<TData>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<TData>,
  ): Observable<WrappedResponse<TData>> {
    return next.handle().pipe(
      map((data) => ({
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
