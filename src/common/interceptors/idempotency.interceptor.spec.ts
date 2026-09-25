import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AppException } from '../errors/app.exception.js';
import { IdempotencyService } from '../services/idempotency.service.js';
import { IdempotencyInterceptor } from './idempotency.interceptor.js';

describe('IdempotencyInterceptor', () => {
  const service = {
    begin: vi.fn(),
    complete: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
  };
  const reflector = { getAllAndOverride: vi.fn() };
  const interceptor = new IdempotencyInterceptor(
    reflector as unknown as Reflector,
    service as unknown as IdempotencyService,
  );

  const makeCtx = (key?: string) => {
    const res = { statusCode: 201, status: vi.fn(), setHeader: vi.fn() };
    const req = {
      method: 'POST',
      originalUrl: '/api/deliveries?x=1',
      body: { a: 1 },
      user: { id: 'u1' },
      header: (name: string) => (name === 'idempotency-key' ? key : undefined),
    };
    const ctx = {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as ExecutionContext;
    return { ctx, res };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue(true);
  });

  it('@Idempotent가 없으면 그냥 통과한다', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const { ctx } = makeCtx();
    const next: CallHandler = { handle: () => of('ok') };
    await expect(
      lastValueFrom(await interceptor.intercept(ctx, next)),
    ).resolves.toBe('ok');
    expect(service.begin).not.toHaveBeenCalled();
  });

  it('헤더가 없으면 IDEMPOTENCY_KEY_REQUIRED', async () => {
    const { ctx } = makeCtx();
    await expect(
      interceptor.intercept(ctx, { handle: () => of(1) }),
    ).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    });
  });

  it('처음 보는 키면 실행하고 응답을 저장한다', async () => {
    service.begin.mockResolvedValue({ kind: 'new' });
    const { ctx } = makeCtx('key-00000001');
    const out = await lastValueFrom(
      await interceptor.intercept(ctx, { handle: () => of({ id: 'd1' }) }),
    );
    expect(out).toEqual({ id: 'd1' });
    expect(service.begin).toHaveBeenCalledWith({
      userId: 'u1',
      key: 'key-00000001',
      method: 'POST',
      path: '/api/deliveries',
      body: { a: 1 },
    });
    expect(service.complete).toHaveBeenCalledWith('u1', 'key-00000001', 201, {
      id: 'd1',
    });
  });

  it('끝난 키면 핸들러를 부르지 않고 저장한 응답을 돌려준다', async () => {
    service.begin.mockResolvedValue({
      kind: 'replay',
      status: 201,
      body: { id: 'd1' },
    });
    const { ctx, res } = makeCtx('key-00000001');
    const handle = vi.fn();
    const out = await lastValueFrom(
      await interceptor.intercept(ctx, { handle }),
    );
    expect(out).toEqual({ id: 'd1' });
    expect(handle).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.setHeader).toHaveBeenCalledWith('Idempotent-Replayed', 'true');
  });

  it('실패하면 키를 풀어 주고 오류를 그대로 던진다', async () => {
    service.begin.mockResolvedValue({ kind: 'new' });
    const { ctx } = makeCtx('key-00000001');
    const err = new AppException('INSUFFICIENT_CREDITS', { need: 10 });
    const obs = await interceptor.intercept(ctx, {
      handle: () => throwError(() => err),
    });
    await expect(lastValueFrom(obs)).rejects.toBe(err);
    expect(service.abort).toHaveBeenCalledWith('u1', 'key-00000001');
    expect(service.complete).not.toHaveBeenCalled();
  });
});
