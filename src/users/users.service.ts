import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppleSignInService } from '../auth/apple-sign-in.service.js';
import { AuthIdentity } from '../auth/entities/auth-identity.entity.js';
import { KakaoService } from '../auth/kakao.service.js';
import { AppException } from '../common/errors/app.exception.js';
import { Delivery } from '../deliveries/entities/delivery.entity.js';
import { FriendsService } from '../friends/friends.service.js';
import { Recording } from '../recordings/entities/recording.entity.js';
import { ShelfService } from '../shelf/shelf.service.js';
import { MeResponse } from './dto/me.response.js';
import { UpdateMeDto } from './dto/update-me.dto.js';
import { TapeInventory } from './entities/tape-inventory.entity.js';
import { NAME_MAX_LENGTH, User } from './entities/user.entity.js';

/** 이름 규칙: 앞뒤 공백 제거 후 1~8자(코드 포인트 기준), 제어 문자 금지 */
export function normalizeName(raw: string): string {
  const name = raw.normalize('NFC').trim();
  const length = [...name].length;
  const hasControlChar = [...name].some((ch) => {
    const code = ch.codePointAt(0)!;
    return code < 0x20 || code === 0x7f;
  });
  if (length < 1 || length > NAME_MAX_LENGTH || hasControlChar) {
    throw new AppException('INVALID_NAME');
  }
  return name;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(TapeInventory)
    private readonly tapes: Repository<TapeInventory>,
    @InjectRepository(AuthIdentity)
    private readonly identities: Repository<AuthIdentity>,
    @InjectRepository(Delivery)
    private readonly deliveries: Repository<Delivery>,
    private readonly friends: FriendsService,
    private readonly shelf: ShelfService,
    private readonly kakao: KakaoService,
    private readonly appleSignIn: AppleSignInService,
  ) {}

  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new AppException('USER_NOT_FOUND');

    const [stock, identities, friendCount, drawer, sentCount] =
      await Promise.all([
        this.tapes.findBy({ userId }),
        this.identities.find({
          where: { userId },
          order: { createdAt: 'ASC' },
        }),
        this.friends.count(userId),
        this.shelf.counts(userId),
        this.deliveries.countBy({ senderId: userId }),
      ]);
    const qty = (t: 3 | 5) => stock.find((s) => s.tapeType === t)?.qty ?? 0;
    const { stored, unopened } = drawer;
    // 받은 테이프 수 = 지금 서랍에 있는 테이프 수 (디자인과 같음)
    const receivedCount = stored;

    return {
      id: user.id,
      name: user.name,
      credits: user.credits,
      drawer: {
        stored,
        cap: user.drawerCap,
        full: stored >= user.drawerCap,
        unopenedCount: unopened,
      },
      tapes: [
        { tapeType: 1, qty: null },
        { tapeType: 3, qty: qty(3) },
        { tapeType: 5, qty: qty(5) },
      ],
      stats: { receivedCount, sentCount, friendCount },
      providers: identities.map((i) => i.provider),
      notificationsEnabled: user.notificationsEnabled,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<MeResponse> {
    const patch: Partial<User> = {};
    if (dto.name !== undefined) patch.name = normalizeName(dto.name);
    if (dto.notificationsEnabled !== undefined) {
      patch.notificationsEnabled = dto.notificationsEnabled;
    }
    if (Object.keys(patch).length > 0) {
      const result = await this.users.update({ id: userId }, patch);
      if (!result.affected) throw new AppException('USER_NOT_FOUND');
    }
    return this.getMe(userId);
  }

  /**
   * 회원 탈퇴 (docs/api.md "회원 탈퇴 데이터 정책").
   * - 받은 테이프, 아직 아무도 안 받은 내 링크 테이프, 보내지 않은 녹음: 파일과 함께 삭제
   * - 받은 사람이 있는 보낸 테이프: 받은 사람 서랍에 남는다 (sender_id·owner_id는 FK로 NULL)
   * - 나머지(로그인 계정, 토큰, 친구·차단 양방향, 원장, 보유 테이프, 칸, 멱등 키)는 FK CASCADE
   */
  async withdraw(userId: string): Promise<void> {
    const identities = await this.identities.findBy({ userId });
    const purged = await this.dataSource.transaction(async (m) => {
      const recordings: Pick<Recording, 'id' | 'rawKey' | 'processedKey'>[] =
        await m
          .createQueryBuilder(Recording, 'r')
          .select(['r.id', 'r.rawKey', 'r.processedKey'])
          .leftJoin(Delivery, 'd', 'd.recording_id = r.id')
          .where('d.recipient_id = :userId', { userId })
          .orWhere('d.sender_id = :userId AND d.recipient_id IS NULL', {
            userId,
          })
          .orWhere('r.owner_id = :userId AND d.id IS NULL', { userId })
          .getMany();
      if (recordings.length > 0) {
        // deliveries는 recording FK(ON DELETE CASCADE)로 함께 지워진다
        await m.delete(
          Recording,
          recordings.map((r) => r.id),
        );
      }
      const result = await m.delete(User, { id: userId });
      if (!result.affected) throw new AppException('USER_NOT_FOUND');
      return recordings;
    });
    await this.shelf.purgeFiles(purged);
    await this.unlinkSocial(identities);
  }

  /** 탈퇴 후 소셜 연결 해제 (카카오 연결 끊기, Apple 토큰 철회). 실패해도 탈퇴는 끝난 상태다 */
  private async unlinkSocial(identities: AuthIdentity[]): Promise<void> {
    for (const identity of identities) {
      try {
        if (identity.provider === 'kakao')
          await this.kakao.unlink(identity.providerSub);
        if (identity.provider === 'apple') {
          await this.appleSignIn.revoke(identity.providerRefreshToken);
        }
      } catch (e) {
        this.logger.error(`${identity.provider} 연결 해제 실패: ${String(e)}`);
      }
    }
  }
}
