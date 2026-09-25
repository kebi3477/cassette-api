import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppException } from '../common/errors/app.exception.js';
import { User } from '../users/entities/user.entity.js';
import {
  BlockedUserResponse,
  FriendResponse,
  ListResponse,
} from './dto/friend.response.js';
import { Block } from './entities/block.entity.js';
import { Friendship } from './entities/friendship.entity.js';

/** 이름을 아직 정하지 않은 사용자를 보여 줄 때 */
export const UNNAMED = '이름 없음';

interface FriendRow {
  user_id: string;
  name: string | null;
  starred: boolean;
  last_at: Date | null;
}

@Injectable()
export class FriendsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Friendship)
    private readonly friendships: Repository<Friendship>,
    @InjectRepository(Block) private readonly blocks: Repository<Block>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** 친구 목록. 즐겨찾기 먼저, 그다음 최근에 주고받은 순 */
  async list(userId: string): Promise<ListResponse<FriendResponse>> {
    const rows = await this.friendQuery(userId)
      .orderBy('f.starred', 'DESC')
      .addOrderBy('f.last_at', 'DESC', 'NULLS LAST')
      .addOrderBy('f.created_at', 'DESC')
      .getRawMany<FriendRow>();
    return { items: rows.map(toFriend) };
  }

  async get(userId: string, friendId: string): Promise<FriendResponse> {
    const row = await this.friendQuery(userId)
      .andWhere('f.friend_id = :friendId', { friendId })
      .getRawOne<FriendRow>();
    if (!row) throw new AppException('FRIEND_NOT_FOUND');
    return toFriend(row);
  }

  async setStarred(
    userId: string,
    friendId: string,
    starred: boolean,
  ): Promise<FriendResponse> {
    const result = await this.friendships.update(
      { userId, friendId },
      { starred },
    );
    if (!result.affected) throw new AppException('FRIEND_NOT_FOUND');
    return this.get(userId, friendId);
  }

  /** 목록에서 빼기. 내 쪽 줄만 지운다 (상대 목록에는 남는다) */
  async remove(userId: string, friendId: string): Promise<void> {
    const result = await this.friendships.delete({ userId, friendId });
    if (!result.affected) throw new AppException('FRIEND_NOT_FOUND');
  }

  /**
   * 차단. 내 친구 목록에서 빼고 차단 목록에 넣는다.
   * 이미 차단했으면 그대로 둔다. 상대에게는 알리지 않는다.
   */
  async block(userId: string, targetId: string): Promise<BlockedUserResponse> {
    if (userId === targetId) throw new AppException('CANNOT_BLOCK_SELF');
    const target = await this.users.findOneBy({ id: targetId });
    if (!target) throw new AppException('USER_NOT_FOUND');

    const block = await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOneBy(Block, {
        userId,
        blockedId: targetId,
      });
      if (existing) return existing;
      const friendship = await manager.findOneBy(Friendship, {
        userId,
        friendId: targetId,
      });
      if (friendship)
        await manager.delete(Friendship, { userId, friendId: targetId });
      return manager.save(
        manager.create(Block, {
          userId,
          blockedId: targetId,
          wasFriend: !!friendship,
          friendStarred: friendship?.starred ?? false,
          friendLastAt: friendship?.lastAt ?? null,
        }),
      );
    });
    return {
      userId: targetId,
      name: target.name ?? UNNAMED,
      blockedAt: block.createdAt.toISOString(),
    };
  }

  async listBlocked(
    userId: string,
  ): Promise<ListResponse<BlockedUserResponse>> {
    const rows = await this.blocks
      .createQueryBuilder('b')
      .innerJoin(User, 'u', 'u.id = b.blocked_id')
      .select('b.blocked_id', 'user_id')
      .addSelect('u.name', 'name')
      .addSelect('b.created_at', 'created_at')
      .where('b.user_id = :userId', { userId })
      .orderBy('b.created_at', 'DESC')
      .getRawMany<{ user_id: string; name: string | null; created_at: Date }>();
    return {
      items: rows.map((r) => ({
        userId: r.user_id,
        name: r.name ?? UNNAMED,
        blockedAt: new Date(r.created_at).toISOString(),
      })),
    };
  }

  /** 차단 해제. 차단하기 전에 친구였다면 친구 목록으로 되돌린다 */
  async unblock(userId: string, targetId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const block = await manager.findOneBy(Block, {
        userId,
        blockedId: targetId,
      });
      if (!block) throw new AppException('BLOCK_NOT_FOUND');
      await manager.delete(Block, { userId, blockedId: targetId });
      if (block.wasFriend) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(Friendship)
          .values({
            userId,
            friendId: targetId,
            starred: block.friendStarred,
            lastAt: block.friendLastAt,
          })
          .orIgnore()
          .execute();
      }
    });
  }

  /** a가 b를 차단했는지 (2단계 보내기·선물에서 쓴다) */
  isBlocked(userId: string, otherId: string): Promise<boolean> {
    return this.blocks.existsBy({ userId, blockedId: otherId });
  }

  private friendQuery(userId: string) {
    return this.friendships
      .createQueryBuilder('f')
      .innerJoin(User, 'u', 'u.id = f.friend_id')
      .select('f.friend_id', 'user_id')
      .addSelect('u.name', 'name')
      .addSelect('f.starred', 'starred')
      .addSelect('f.last_at', 'last_at')
      .where('f.user_id = :userId', { userId });
  }
}

function toFriend(r: FriendRow): FriendResponse {
  return {
    userId: r.user_id,
    name: r.name ?? UNNAMED,
    starred: r.starred,
    lastAt: r.last_at ? new Date(r.last_at).toISOString() : null,
  };
}
