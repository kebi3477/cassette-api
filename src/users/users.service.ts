import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthIdentity } from '../auth/entities/auth-identity.entity.js';
import { AppException } from '../common/errors/app.exception.js';
import { Friendship } from '../friends/entities/friendship.entity.js';
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
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(TapeInventory)
    private readonly tapes: Repository<TapeInventory>,
    @InjectRepository(AuthIdentity)
    private readonly identities: Repository<AuthIdentity>,
    @InjectRepository(Friendship)
    private readonly friendships: Repository<Friendship>,
  ) {}

  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new AppException('USER_NOT_FOUND');

    const [stock, identities, friendCount] = await Promise.all([
      this.tapes.findBy({ userId }),
      this.identities.find({ where: { userId }, order: { createdAt: 'ASC' } }),
      this.friendships.countBy({ userId }),
    ]);
    const qty = (t: 3 | 5) => stock.find((s) => s.tapeType === t)?.qty ?? 0;

    // TODO(2단계): deliveries가 생기면 보관량·받은·보낸 수를 채운다
    const stored = 0;
    const receivedCount = 0;
    const sentCount = 0;

    return {
      id: user.id,
      name: user.name,
      credits: user.credits,
      drawer: { stored, cap: user.drawerCap, full: stored >= user.drawerCap },
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
   * 회원 탈퇴. users 줄을 지우면 FK(ON DELETE CASCADE)로
   * 로그인 계정, refresh token, 친구·차단(양방향), 크레딧 원장, 보유 테이프, 멱등 키가 함께 지워진다.
   * 정책은 docs/api.md "회원 탈퇴" 참고.
   */
  async withdraw(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const result = await manager.delete(User, { id: userId });
      if (!result.affected) throw new AppException('USER_NOT_FOUND');
    });
  }
}
