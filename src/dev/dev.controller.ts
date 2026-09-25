import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  type AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator.js';
import { DevOnlyGuard } from '../common/guards/dev-only.guard.js';
import type { FriendResponse } from '../friends/dto/friend.response.js';
import type { WalletResponse } from '../wallet/dto/wallet.response.js';
import { DevService } from './dev.service.js';
import { CreateDevFriendDto } from './dto/create-dev-friend.dto.js';
import { DevCreditsDto } from './dto/dev-credits.dto.js';
import { type SeedResult, SeedService } from './seed.service.js';

/** 개발 전용. NODE_ENV=production이면 모든 경로가 404 */
@UseGuards(DevOnlyGuard)
@Controller('dev')
export class DevController {
  constructor(
    private readonly devService: DevService,
    private readonly seedService: SeedService,
  ) {}

  /** 가짜 친구 만들기 (또는 기존 사용자와 친구 맺기) */
  @Post('friends')
  createFriend(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDevFriendDto,
  ): Promise<FriendResponse> {
    return this.devService.createFriend(user.id, dto);
  }

  /** 크레딧 받기 (광고 보상 흉내 / 충전 흉내 / 임의 금액) */
  @Post('credits')
  @HttpCode(HttpStatus.OK)
  credits(
    @CurrentUser() user: AuthUser,
    @Body() dto: DevCreditsDto,
  ): Promise<WalletResponse> {
    return this.devService.credits(user.id, dto);
  }

  /** 내 계정을 프로토타입 초기 데이터로 (기존 테이프·친구·원장은 지운다) */
  @Post('seed')
  @HttpCode(HttpStatus.OK)
  seed(@CurrentUser() user: AuthUser): Promise<SeedResult> {
    return this.seedService.seed(user.id);
  }
}
