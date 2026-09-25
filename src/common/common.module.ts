import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { IdempotencyKey } from './entities/idempotency-key.entity.js';
import { HttpExceptionFilter } from './filters/http-exception.filter.js';
import { DevOnlyGuard } from './guards/dev-only.guard.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor.js';
import { createValidationPipe } from './pipes/validation.pipe.js';
import { ClockService } from './services/clock.service.js';
import { IdempotencyService } from './services/idempotency.service.js';

/**
 * 전역 설정: 인증 가드, 멱등 인터셉터, ValidationPipe, `{ code, message }` 예외 필터, JWT.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([IdempotencyKey, User]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  providers: [
    IdempotencyService,
    ClockService,
    DevOnlyGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
  exports: [IdempotencyService, ClockService, DevOnlyGuard],
})
export class CommonModule {}
