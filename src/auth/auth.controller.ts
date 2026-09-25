import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { DevOnlyGuard } from '../common/guards/dev-only.guard.js';
import { AuthService } from './auth.service.js';
import { AppleLoginDto } from './dto/apple-login.dto.js';
import type { AuthResponse, TokenPair } from './dto/auth.response.js';
import { DevLoginDto } from './dto/dev-login.dto.js';
import { KakaoLoginDto } from './dto/kakao-login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('kakao')
  @HttpCode(HttpStatus.OK)
  kakao(@Body() dto: KakaoLoginDto): Promise<AuthResponse> {
    return this.authService.loginWithKakao(dto.accessToken);
  }

  @Post('apple')
  @HttpCode(HttpStatus.OK)
  apple(@Body() dto: AppleLoginDto): Promise<AuthResponse> {
    return this.authService.loginWithApple(dto.identityToken, dto.nonce);
  }

  /** 개발 전용 로그인. NODE_ENV=production이면 404 */
  @Post('dev')
  @UseGuards(DevOnlyGuard)
  @HttpCode(HttpStatus.OK)
  dev(@Body() dto: DevLoginDto): Promise<AuthResponse> {
    return this.authService.loginDev(dto.key, dto.name);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenPair> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }
}
