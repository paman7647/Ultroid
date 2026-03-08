import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { ServerResponse } from 'http';
import { Observable, tap } from 'rxjs';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ id?: string }>();
    request.id = randomUUID();
    const response = context.switchToHttp().getResponse<ServerResponse>();
    response.setHeader('x-request-id', request.id);

    const startedAt = Date.now();
    return next.handle().pipe(
      tap(() => {
        if (!response.headersSent) {
          response.setHeader('x-response-time-ms', Date.now() - startedAt);
        }
      }),
    );
  }
}
