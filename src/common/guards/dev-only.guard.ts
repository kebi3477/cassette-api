import { CanActivate, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../errors/app.exception.js';

/** 운영(NODE_ENV=production)에서는 없는 엔드포인트처럼 404를 낸다. */
@Injectable()
export class DevOnlyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(): boolean {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new AppException('NOT_FOUND');
    }
    return true;
  }
}
