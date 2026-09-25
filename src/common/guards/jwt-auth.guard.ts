import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import type { AuthedRequest } from '../decorators/current-user.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { AppException } from '../errors/app.exception.js';

export interface AccessTokenPayload {
  sub: string;
  typ: 'access';
}

/**
 * 전역 인증 가드. `@Public()`이 없으면 `Authorization: Bearer <access token>`이 필요하다.
 * 탈퇴한 사용자의 토큰은 만료 전이라도 거절한다.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = (req.header('authorization') ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new AppException('UNAUTHORIZED');

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new AppException('UNAUTHORIZED');
    }
    if (payload.typ !== 'access' || !payload.sub) {
      throw new AppException('UNAUTHORIZED');
    }
    const exists = await this.users.existsBy({ id: payload.sub });
    if (!exists) throw new AppException('UNAUTHORIZED');

    req.user = { id: payload.sub };
    return true;
  }
}
