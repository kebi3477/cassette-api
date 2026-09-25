import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { catchError, from, mergeMap, Observable, of, throwError } from 'rxjs';
import type { AuthedRequest } from '../decorators/current-user.decorator.js';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator.js';
import { AppException } from '../errors/app.exception.js';
import { IdempotencyService } from '../services/idempotency.service.js';

export const IDEMPOTENCY_HEADER = 'idempotency-key';
export const REPLAYED_HEADER = 'Idempotent-Replayed';
const KEY_PATTERN = /^[A-Za-z0-9_\-:.]{8,255}$/;

/**
 * `@Idempotent()`가 붙은 엔드포인트에서 `Idempotency-Key` 헤더를 처리한다.
 * - 처음 보는 키: 실행하고, 성공하면 응답을 저장한다. 실패하면 키를 풀어 준다.
 * - 끝난 키: 저장한 응답을 그대로 돌려준다 (`Idempotent-Replayed: true`).
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly idempotency: IdempotencyService,
  ) {}

  async intercept(
    ctx: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const enabled = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!enabled) return next.handle();

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const key = req.header(IDEMPOTENCY_HEADER);
    if (!key || !KEY_PATTERN.test(key)) {
      throw new AppException('IDEMPOTENCY_KEY_REQUIRED');
    }
    if (!req.user) throw new AppException('UNAUTHORIZED');
    const userId = req.user.id;

    const start = await this.idempotency.begin({
      userId,
      key,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      body: req.body,
    });
    if (start.kind === 'replay') {
      res.status(start.status);
      res.setHeader(REPLAYED_HEADER, 'true');
      return of(start.body);
    }

    return next.handle().pipe(
      mergeMap((body) =>
        from(
          this.idempotency
            .complete(userId, key, res.statusCode, body)
            .then(() => body),
        ),
      ),
      catchError((err: unknown) =>
        from(this.idempotency.abort(userId, key)).pipe(
          mergeMap(() => throwError(() => err)),
        ),
      ),
    );
  }
}
