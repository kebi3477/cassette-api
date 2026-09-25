import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import { IdempotencyKey } from '../entities/idempotency-key.entity.js';
import { AppException } from '../errors/app.exception.js';

export interface IdempotencyRequest {
  userId: string;
  key: string;
  method: string;
  path: string;
  body: unknown;
}

export type IdempotencyStart =
  { kind: 'new' } | { kind: 'replay'; status: number; body: unknown };

export function hashRequestBody(body: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(body ?? null))
    .digest('hex');
}

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
  ) {}

  /**
   * 키를 선점한다. 처음 보는 키면 `new`, 이미 끝난 요청이면 저장해 둔 응답을 돌려준다.
   * 같은 키로 다른 요청이 오면 IDEMPOTENCY_KEY_REUSED, 아직 처리 중이면 IDEMPOTENCY_IN_PROGRESS.
   */
  async begin(req: IdempotencyRequest): Promise<IdempotencyStart> {
    const requestHash = hashRequestBody(req.body);
    const inserted = await this.repo
      .createQueryBuilder()
      .insert()
      .values({
        userId: req.userId,
        key: req.key,
        method: req.method,
        path: req.path,
        requestHash,
      })
      .orIgnore()
      .returning(['key'])
      .execute();
    if (inserted.raw.length > 0) return { kind: 'new' };

    const existing = await this.repo.findOneBy({
      userId: req.userId,
      key: req.key,
    });
    if (!existing) {
      // 선점과 조회 사이에 abort로 지워졌다. 다시 시도하게 한다
      throw new AppException('IDEMPOTENCY_IN_PROGRESS');
    }
    if (
      existing.requestHash !== requestHash ||
      existing.method !== req.method ||
      existing.path !== req.path
    ) {
      throw new AppException('IDEMPOTENCY_KEY_REUSED');
    }
    if (existing.responseStatus === null) {
      throw new AppException('IDEMPOTENCY_IN_PROGRESS');
    }
    return {
      kind: 'replay',
      status: existing.responseStatus,
      body: existing.responseBody,
    };
  }

  /** 성공한 응답을 저장한다 */
  async complete(
    userId: string,
    key: string,
    status: number,
    body: unknown,
  ): Promise<void> {
    await this.repo.update(
      { userId, key },
      { responseStatus: status, responseBody: (body ?? null) as object },
    );
  }

  /** 실패한 요청의 키를 풀어서 같은 키로 다시 시도할 수 있게 한다 */
  async abort(userId: string, key: string): Promise<void> {
    await this.repo.delete({ userId, key });
  }
}
