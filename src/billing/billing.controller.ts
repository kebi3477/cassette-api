import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  type AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator.js';
import { Idempotent } from '../common/decorators/idempotent.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { type IapResponse, BillingService } from './billing.service.js';
import {
  AppleNotificationDto,
  PubSubPushDto,
} from './dto/store-notification.dto.js';
import { VerifyIapDto } from './dto/verify-iap.dto.js';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /** 인앱 결제 영수증 확인 → 크레딧 충전 */
  @Post('iap')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  iap(
    @CurrentUser() user: AuthUser,
    @Body() dto: VerifyIapDto,
  ): Promise<IapResponse> {
    return this.billingService.verifyIap(user.id, dto);
  }

  /** AdMob 보상형 광고 SSV 콜백 (Google이 부른다) */
  @Public()
  @Get('admob/ssv')
  async admobSsv(@Req() req: Request): Promise<{ ok: true }> {
    const raw = req.originalUrl.split('?')[1] ?? '';
    await this.billingService.handleAdmobSsv(raw);
    return { ok: true };
  }

  /** App Store Server Notifications V2 */
  @Public()
  @Post('apple/notifications')
  @HttpCode(HttpStatus.OK)
  async apple(@Body() dto: AppleNotificationDto): Promise<{ ok: true }> {
    await this.billingService.handleAppleNotification(dto.signedPayload);
    return { ok: true };
  }

  /** Google Play 실시간 개발자 알림 (Pub/Sub 푸시) */
  @Public()
  @Post('google/rtdn')
  @HttpCode(HttpStatus.OK)
  async rtdn(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: PubSubPushDto,
  ): Promise<{ ok: true }> {
    await this.billingService.handlePlayRtdn(authorization, dto.message.data);
    return { ok: true };
  }
}
