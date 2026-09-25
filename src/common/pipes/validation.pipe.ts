import { ValidationError, ValidationPipe } from '@nestjs/common';
import { AppException } from '../errors/app.exception.js';

function collectFields(errors: ValidationError[], prefix = ''): string[] {
  return errors.flatMap((e) => {
    const path = prefix ? `${prefix}.${e.property}` : e.property;
    return e.children?.length ? collectFields(e.children, path) : [path];
  });
}

/**
 * 전역 ValidationPipe. DTO에 없는 필드가 오면 거절하고,
 * 실패하면 `{ code: 'VALIDATION_FAILED', message, fields }`로 응답한다.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new AppException('VALIDATION_FAILED', { fields: collectFields(errors) }),
  });
}
