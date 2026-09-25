import { Injectable } from '@nestjs/common';

/**
 * 현재 시각. 기간 판정(재가입 제한 등)에서 쓰고, 테스트에서는 시계를 옮길 수 있게 바꾼다.
 */
@Injectable()
export class ClockService {
  now(): Date {
    return new Date();
  }
}
