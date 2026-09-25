import { HttpStatus } from '@nestjs/common';

/**
 * 오류 코드 목록. `docs/api.md`의 "오류 코드" 표와 같게 유지한다.
 * message는 앱이 그대로 토스트에 띄울 수 있는 디자인 톤의 한국어다.
 */
export const ErrorCodes = {
  // 공통
  VALIDATION_FAILED: {
    status: HttpStatus.BAD_REQUEST,
    message: '입력한 내용을 다시 확인해 주세요',
  },
  UNAUTHORIZED: {
    status: HttpStatus.UNAUTHORIZED,
    message: '다시 로그인해 주세요',
  },
  FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    message: '할 수 없는 요청이에요',
  },
  NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: '찾을 수 없어요' },
  RATE_LIMITED: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: '잠시 후에 다시 시도해 주세요',
  },
  INTERNAL_ERROR: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  },

  // 멱등
  IDEMPOTENCY_KEY_REQUIRED: {
    status: HttpStatus.BAD_REQUEST,
    message: '요청을 다시 보내 주세요',
  },
  IDEMPOTENCY_KEY_REUSED: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: '이미 다른 요청에 쓴 키예요',
  },
  IDEMPOTENCY_IN_PROGRESS: {
    status: HttpStatus.CONFLICT,
    message: '처리하고 있어요. 잠시만 기다려 주세요',
  },

  // auth
  SOCIAL_TOKEN_INVALID: {
    status: HttpStatus.UNAUTHORIZED,
    message: '로그인하지 못했어요. 다시 시도해 주세요',
  },
  SOCIAL_PROVIDER_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: '로그인 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요',
  },
  INVALID_REFRESH_TOKEN: {
    status: HttpStatus.UNAUTHORIZED,
    message: '다시 로그인해 주세요',
  },

  // users
  USER_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: '찾을 수 없는 사용자예요',
  },
  INVALID_NAME: {
    status: HttpStatus.BAD_REQUEST,
    message: '이름은 1~8자로 적어주세요',
  },

  // wallet
  INSUFFICIENT_CREDITS: {
    status: HttpStatus.PAYMENT_REQUIRED,
    message: '크레딧이 부족해요',
  },

  // friends
  FRIEND_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: '친구 목록에 없는 사람이에요',
  },
  CANNOT_BLOCK_SELF: {
    status: HttpStatus.BAD_REQUEST,
    message: '나는 차단할 수 없어요',
  },
  BLOCK_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: '차단한 친구가 아니에요',
  },
} as const satisfies Record<string, { status: HttpStatus; message: string }>;

export type ErrorCode = keyof typeof ErrorCodes;
