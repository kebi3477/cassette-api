import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { AppleService } from './apple.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthIdentity } from './entities/auth-identity.entity.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { KakaoService } from './kakao.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthIdentity, RefreshToken]),
    UsersModule,
    WalletModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, KakaoService, AppleService],
  exports: [AuthService],
})
export class AuthModule {}
