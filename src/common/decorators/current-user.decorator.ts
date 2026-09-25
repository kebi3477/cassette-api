import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthUser {
  id: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

/** JwtAuthGuard가 넣어 둔 로그인 사용자. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    return req.user!;
  },
);
