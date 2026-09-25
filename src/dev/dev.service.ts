import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AuthIdentity } from '../auth/entities/auth-identity.entity.js';
import { AppException } from '../common/errors/app.exception.js';
import { FriendResponse } from '../friends/dto/friend.response.js';
import { Friendship } from '../friends/entities/friendship.entity.js';
import { FriendsService } from '../friends/friends.service.js';
import { User } from '../users/entities/user.entity.js';
import { normalizeName } from '../users/users.service.js';
import { CreateDevFriendDto } from './dto/create-dev-friend.dto.js';
import { DevCreditsDto } from './dto/dev-credits.dto.js';
import { findCreditPack, LedgerReasons } from '../shop/products.js';
import type { WalletResponse } from '../wallet/dto/wallet.response.js';
import { WalletService } from '../wallet/wallet.service.js';

/** 개발·테스트용 데이터 만들기. 운영에서는 DevOnlyGuard가 막는다 */
@Injectable()
export class DevService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly friends: FriendsService,
    private readonly wallet: WalletService,
  ) {}

  /**
   * 크레딧 받기 우회로 (개발 전용). 스토어 결제·AdMob SSV를 로컬에서 받을 수 없어서 만든 것.
   * ad는 실제 광고 보상과 같은 경로(하루 3회)를 탄다.
   */
  async credits(userId: string, dto: DevCreditsDto): Promise<WalletResponse> {
    if (dto.type === 'ad') {
      const result = await this.wallet.grantAdReward(
        userId,
        `dev-${randomUUID()}`,
      );
      if (result === 'limit') throw new AppException('AD_LIMIT_REACHED');
    } else if (dto.type === 'charge') {
      const pack = findCreditPack(dto.productId ?? '');
      if (!pack) throw new AppException('PRODUCT_NOT_FOUND');
      await this.dataSource.transaction((m) =>
        this.wallet.apply(m, {
          userId,
          delta: pack.credits,
          kind: 'iap',
          reason: LedgerReasons.charge(pack),
        }),
      );
    } else {
      if (!dto.amount)
        throw new AppException('VALIDATION_FAILED', { fields: ['amount'] });
      const amount = dto.amount;
      await this.dataSource.transaction((m) =>
        this.wallet.apply(m, {
          userId,
          delta: amount,
          kind: 'admin',
          reason: '개발용 지급',
        }),
      );
    }
    return this.wallet.getWallet(userId);
  }

  /** 서로 친구 관계를 만든다 (2단계의 보내기·링크 받기 대신) */
  async createFriend(
    userId: string,
    dto: CreateDevFriendDto,
  ): Promise<FriendResponse> {
    if (!dto.userId === !dto.name) {
      throw new AppException('VALIDATION_FAILED', {
        fields: ['name', 'userId'],
      });
    }
    const friendId = await this.dataSource.transaction(async (manager) => {
      let id = dto.userId;
      if (id) {
        if (id === userId)
          throw new AppException('VALIDATION_FAILED', { fields: ['userId'] });
        if (!(await manager.existsBy(User, { id })))
          throw new AppException('USER_NOT_FOUND');
      } else {
        const user = await manager.save(
          manager.create(User, { name: normalizeName(dto.name!) }),
        );
        await manager.save(
          manager.create(AuthIdentity, {
            userId: user.id,
            provider: 'dev',
            providerSub: `seed-${randomUUID()}`,
            email: null,
          }),
        );
        id = user.id;
      }
      const now = new Date();
      await manager.upsert(
        Friendship,
        [
          { userId, friendId: id, starred: dto.starred ?? false, lastAt: now },
          { userId: id, friendId: userId, starred: false, lastAt: now },
        ],
        ['userId', 'friendId'],
      );
      return id;
    });
    return this.friends.get(userId, friendId);
  }
}
