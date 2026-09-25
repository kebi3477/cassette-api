import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  type AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator.js';
import { DevOnlyGuard } from '../common/guards/dev-only.guard.js';
import type { FriendResponse } from '../friends/dto/friend.response.js';
import { DevService } from './dev.service.js';
import { CreateDevFriendDto } from './dto/create-dev-friend.dto.js';

/** 개발 전용. NODE_ENV=production이면 모든 경로가 404 */
@UseGuards(DevOnlyGuard)
@Controller('dev')
export class DevController {
  constructor(private readonly devService: DevService) {}

  /** 가짜 친구 만들기 (또는 기존 사용자와 친구 맺기) */
  @Post('friends')
  createFriend(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDevFriendDto,
  ): Promise<FriendResponse> {
    return this.devService.createFriend(user.id, dto);
  }
}
