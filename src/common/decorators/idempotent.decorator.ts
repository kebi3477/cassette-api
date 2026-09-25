import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'idempotent';

/**
 * `Idempotency-Key` 헤더가 필요한 엔드포인트에 붙인다.
 * 같은 키로 다시 오면 처음 응답을 그대로 돌려준다 (IdempotencyInterceptor).
 */
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);
