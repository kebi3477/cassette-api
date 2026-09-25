import { HttpException } from '@nestjs/common';
import { ErrorCode, ErrorCodes } from './error-codes.js';

export interface ErrorBody {
  code: string;
  message: string;
  [extra: string]: unknown;
}

/**
 * `{ code, message }` 형식으로 응답하는 예외.
 * `extra`는 앱이 화면을 그리는 데 필요한 값(예: 부족한 크레딧 `need`)을 담는다.
 */
export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    extra: Record<string, unknown> = {},
    message?: string,
  ) {
    const def = ErrorCodes[code];
    const body: ErrorBody = { code, message: message ?? def.message, ...extra };
    super(body, def.status);
  }
}
