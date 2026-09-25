import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Put,
} from '@nestjs/common';
import {
  type AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator.js';
import { RegisterDeviceDto } from './dto/register-device.dto.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** FCM 토큰 등록 (로그인 후, 토큰이 바뀔 때마다) */
  @Put('devices')
  @HttpCode(HttpStatus.NO_CONTENT)
  async register(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterDeviceDto,
  ): Promise<void> {
    await this.notificationsService.registerDevice(
      user.id,
      dto.token,
      dto.platform,
    );
  }

  /** FCM 토큰 해제 (로그아웃 전에) */
  @Delete('devices/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unregister(
    @CurrentUser() user: AuthUser,
    @Param('token') token: string,
  ): Promise<void> {
    await this.notificationsService.unregisterDevice(user.id, token);
  }
}
