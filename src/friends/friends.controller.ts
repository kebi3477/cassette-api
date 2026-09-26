import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  type AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator.js';
import {
  BlockedUserResponse,
  FriendResponse,
  ListResponse,
} from './dto/friend.response.js';
import { UpdateFriendDto } from './dto/update-friend.dto.js';
import { FriendsService } from './friends.service.js';
import type { FriendTapeItem } from '../shelf/dto/shelf.response.js';
import { ShelfService } from '../shelf/shelf.service.js';

const uuid = new ParseUUIDPipe();

@Controller('friends')
export class FriendsController {
  constructor(
    private readonly friendsService: FriendsService,
    private readonly shelfService: ShelfService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<ListResponse<FriendResponse>> {
    return this.friendsService.list(user.id);
  }

  /** 차단한 친구 목록 (설정 > 차단한 친구) */
  @Get('blocks')
  listBlocked(
    @CurrentUser() user: AuthUser,
  ): Promise<ListResponse<BlockedUserResponse>> {
    return this.friendsService.listBlocked(user.id);
  }

  /** 친구 화면: 그 친구가 보낸 테이프(뜯은 것)와 안 뜯은 수 */
  @Get(':userId/tapes')
  async tapes(
    @CurrentUser() user: AuthUser,
    @Param('userId', uuid) friendId: string,
  ): Promise<{
    friend: FriendResponse;
    items: FriendTapeItem[];
    unopenedCount: number;
  }> {
    const friend = await this.friendsService.get(user.id, friendId);
    return {
      friend,
      ...(await this.shelfService.tapesFrom(user.id, friendId)),
    };
  }

  /** 즐겨찾기 켜기/끄기 */
  @Patch(':userId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('userId', uuid) friendId: string,
    @Body() dto: UpdateFriendDto,
  ): Promise<FriendResponse> {
    return this.friendsService.update(user.id, friendId, dto);
  }

  /** 목록에서 빼기 */
  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('userId', uuid) friendId: string,
  ): Promise<void> {
    await this.friendsService.remove(user.id, friendId);
  }

  /** 차단 */
  @Post(':userId/block')
  @HttpCode(HttpStatus.OK)
  block(
    @CurrentUser() user: AuthUser,
    @Param('userId', uuid) targetId: string,
  ): Promise<BlockedUserResponse> {
    return this.friendsService.block(user.id, targetId);
  }

  /** 차단 해제 */
  @Delete(':userId/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unblock(
    @CurrentUser() user: AuthUser,
    @Param('userId', uuid) targetId: string,
  ): Promise<void> {
    await this.friendsService.unblock(user.id, targetId);
  }
}
