import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  type AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator.js';
import { Idempotent } from '../common/decorators/idempotent.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import type {
  ClaimResponse,
  SharePreview,
  WebPreview,
} from './dto/share.response.js';
import { ShareService } from './share.service.js';

@Controller('share')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  /** 앱에서 링크 열기 */
  @Get(':token')
  preview(
    @CurrentUser() user: AuthUser,
    @Param('token') token: string,
  ): Promise<SharePreview> {
    return this.shareService.preview(user.id, token);
  }

  /** 링크 테이프 받기 → 서로 친구 */
  @Post(':token/claim')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  claim(
    @CurrentUser() user: AuthUser,
    @Param('token') token: string,
  ): Promise<ClaimResponse> {
    return this.shareService.claim(user.id, token);
  }

  /** 웹 페이지용 미리보기 */
  @Public()
  @Get(':token/web')
  web(@Param('token') token: string): Promise<WebPreview> {
    return this.shareService.webPreview(token);
  }

  /** 웹 재생 URL */
  @Public()
  @Post(':token/web/audio')
  @HttpCode(HttpStatus.OK)
  webAudio(
    @Param('token') token: string,
  ): Promise<{ url: string; expiresAt: string; durationMs: number }> {
    return this.shareService.webAudio(token);
  }
}
