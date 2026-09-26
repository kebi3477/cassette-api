import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource, EntityManager, In } from 'typeorm';
import { AuthIdentity } from '../auth/entities/auth-identity.entity.js';
import { SHARE_LINK_TTL_MS } from '../deliveries/delivery.mapper.js';
import { Delivery, Tag } from '../deliveries/entities/delivery.entity.js';
import { Block } from '../friends/entities/block.entity.js';
import { Friendship } from '../friends/entities/friendship.entity.js';
import {
  Recording,
  TapeType,
} from '../recordings/entities/recording.entity.js';
import { keysBetween } from '../shelf/position.js';
import { ShelfGroup } from '../shelf/entities/shelf-group.entity.js';
import { ShelfService } from '../shelf/shelf.service.js';
import { StorageService } from '../storage/storage.service.js';
import { TapeInventory } from '../users/entities/tape-inventory.entity.js';
import { User } from '../users/entities/user.entity.js';
import { AdReward } from '../wallet/entities/ad-reward.entity.js';
import {
  CreditLedger,
  LedgerKind,
} from '../wallet/entities/credit-ledger.entity.js';
import { makeToneWav } from './tone.js';

/** 프로토타입(TapeletterApp.logic.js) 초기 데이터 */
const FRIENDS = [
  { name: '지현', star: true, last: '09.24' },
  { name: '엄마', star: true, last: '09.10' },
  { name: '민수', star: false, last: '08.30' },
  { name: '하늘', star: false, last: '09.23' },
  { name: '박과장님', star: false, last: '06.02' },
  { name: '은비', star: false, last: '06.03' },
];
/** 칸에만 나오는 보낸 사람 (친구 목록에는 없음) */
const OTHERS = ['수아', '할머니', '유진'];

type Item = { from: string; date: string; type: TapeType; tag: Tag };
const TAG = { 생일: 'birthday', 축하: 'congrats', 그냥: 'thinking' } as const;
const it = (
  from: string,
  date: string,
  type: TapeType,
  tag: keyof typeof TAG = '생일',
): Item => ({
  from,
  date,
  type,
  tag: TAG[tag],
});

const INBOX = [
  { ...it('지현', '09.24', 3), viaLink: false },
  { ...it('하늘', '09.23', 1, '그냥'), viaLink: true },
];
const GROUPS = [
  {
    name: '2026 생일',
    items: [
      it('엄마', '03.14', 5),
      it('민수', '03.14', 1),
      it('수아', '03.15', 3),
      it('할머니', '03.14', 1),
    ],
  },
  {
    name: '승진 축하',
    items: [it('박과장님', '06.02', 3, '축하'), it('은비', '06.03', 1, '축하')],
  },
  {
    name: '엄마 목소리',
    items: [it('엄마', '01.01', 5, '그냥'), it('엄마', '05.08', 3, '그냥')],
  },
];
const SENT = [
  { to: '유진', date: '09.22', type: 1 as TapeType, link: true, opened: null },
  {
    to: '엄마',
    date: '09.10',
    type: 3 as TapeType,
    link: false,
    opened: '09.11',
  },
  { to: '민수', date: '08.30', type: 1 as TapeType, link: false, opened: null },
  {
    to: '박과장님',
    date: '06.01',
    type: 1 as TapeType,
    link: false,
    opened: '06.02',
  },
];
/** 최신이 뒤 (잔액 순서대로 쌓는다): 합계 120 */
const LEDGER: { date: string; why: string; amt: number; kind: LedgerKind }[] = [
  { date: '09.01', why: '가입 선물', amt: 10, kind: 'signup_gift' },
  { date: '09.12', why: '지현님이 선물', amt: 30, kind: 'gift_received' },
  { date: '09.18', why: '크레딧 충전 · ₩1,100', amt: 100, kind: 'iap' },
  { date: '09.20', why: '3분 테이프 구매', amt: -30, kind: 'tape_purchase' },
  { date: '09.24', why: '광고 보상', amt: 10, kind: 'ad_reward' },
];
const TONES: Record<string, number> = {
  지현: 523,
  엄마: 392,
  민수: 440,
  하늘: 587,
  박과장님: 330,
  은비: 659,
  수아: 494,
  할머니: 349,
  유진: 698,
  민경: 466,
};

export interface SeedResult {
  friends: number;
  stored: number;
  groups: number;
  sent: number;
  credits: number;
}

/**
 * 개발 시드: 로그인한 사용자의 데이터를 지우고 프로토타입 초기 상태로 만든다.
 * 친구 6명, 분류 안 함 2개(안 뜯음, 1개는 링크로 받음), 칸 3개 8개, 보낸 기록 4개,
 * 크레딧 120 + 원장 5줄, 3분 테이프 2개, 서랍 12. 오디오는 생성한 사인파 WAV다.
 */
@Injectable()
export class SeedService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly storage: StorageService,
    private readonly shelf: ShelfService,
  ) {}

  async seed(meId: string): Promise<SeedResult> {
    const year = new Intl.DateTimeFormat('en', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
    }).format(new Date());
    const at = (md: string, hour = 12) => {
      const [mm, dd] = md.split('.');
      return new Date(
        `${year}-${mm}-${dd}T${String(hour).padStart(2, '0')}:00:00+09:00`,
      );
    };
    const dir = await mkdtemp(join(tmpdir(), 'cassette-seed-'));
    const uploads: { key: string; file: string }[] = [];

    try {
      const purged = await this.dataSource.transaction(async (m) => {
        const purged = await this.reset(m, meId);
        const me = await m.findOneByOrFail(User, { id: meId });
        const myName = me.name ?? '민경';
        await m.update(User, meId, {
          name: myName,
          credits: 120,
          drawerCap: 12,
        });

        // 사람들 (같은 사용자에게 다시 시드하면 재사용)
        const people = new Map<string, string>();
        for (const name of [...FRIENDS.map((f) => f.name), ...OTHERS]) {
          people.set(name, await this.person(m, meId, name));
        }

        for (const f of FRIENDS) {
          const friendId = people.get(f.name)!;
          await m.insert(Friendship, [
            { userId: meId, friendId, starred: f.star, lastAt: at(f.last) },
            {
              userId: friendId,
              friendId: meId,
              starred: false,
              lastAt: at(f.last),
            },
          ]);
        }

        let n = 0;
        const recording = async (
          ownerId: string,
          ownerName: string,
          type: TapeType,
        ) => {
          const id = randomUUID();
          const seconds = 3 + (n++ % 4);
          const key = `recordings/${ownerId}/${id}/tape.wav`;
          const file = join(dir, `${id}.wav`);
          await writeFile(file, makeToneWav(seconds, TONES[ownerName] ?? 440));
          uploads.push({ key, file });
          await m.insert(Recording, {
            id,
            ownerId,
            tapeType: type,
            durationMs: seconds * 1000,
            status: 'ready',
            contentType: 'audio/wav',
            rawKey: key,
            processedKey: key,
          });
          return id;
        };

        // 분류 안 함 (안 뜯은 소포)
        const inboxKeys = keysBetween(null, null, INBOX.length);
        for (const [i, x] of INBOX.entries()) {
          const senderId = people.get(x.from)!;
          await m.insert(Delivery, {
            recordingId: await recording(senderId, x.from, x.type),
            senderId,
            senderName: x.from,
            recipientId: meId,
            tag: x.tag,
            sentAt: at(x.date),
            position: inboxKeys[i],
            ...(x.viaLink
              ? {
                  linkName: myName.slice(0, 8),
                  shareToken: randomBytes(24).toString('base64url'),
                  shareExpiresAt: new Date(
                    at(x.date).getTime() + SHARE_LINK_TTL_MS,
                  ),
                  claimedAt: at(x.date, 13),
                }
              : {}),
          });
        }

        // 칸과 그 안의 테이프 (뜯은 상태)
        const groupKeys = keysBetween(null, null, GROUPS.length);
        for (const [gi, g] of GROUPS.entries()) {
          const group = await m.save(
            m.create(ShelfGroup, {
              userId: meId,
              name: g.name,
              position: groupKeys[gi],
            }),
          );
          const keys = keysBetween(null, null, g.items.length);
          for (const [i, x] of g.items.entries()) {
            const senderId = people.get(x.from)!;
            await m.insert(Delivery, {
              recordingId: await recording(senderId, x.from, x.type),
              senderId,
              senderName: x.from,
              recipientId: meId,
              tag: x.tag,
              sentAt: at(x.date),
              openedAt: at(x.date, 18),
              groupId: group.id,
              position: keys[i],
            });
          }
        }

        // 보낸 기록
        for (const s of SENT) {
          const recipientId = s.link ? null : people.get(s.to)!;
          await m.insert(Delivery, {
            recordingId: await recording(meId, myName, s.type),
            senderId: meId,
            senderName: myName,
            recipientId,
            linkName: s.link ? s.to : null,
            shareToken: s.link ? randomBytes(24).toString('base64url') : null,
            // 링크 대기 상태를 유지하려고 만료는 지금부터 7일
            shareExpiresAt: s.link
              ? new Date(Date.now() + SHARE_LINK_TTL_MS)
              : null,
            sentAt: at(s.date),
            openedAt: s.opened ? at(s.opened) : null,
            position: recipientId ? keysBetween(null, null, 1)[0] : null,
          });
        }

        // 크레딧 원장 5줄 (합계 120), 3분 테이프 2개
        let balance = 0;
        for (const l of LEDGER) {
          balance += l.amt;
          await m.insert(CreditLedger, {
            userId: meId,
            delta: l.amt,
            balanceAfter: balance,
            kind: l.kind,
            reason: l.why,
            createdAt: at(l.date),
          });
        }
        await m.insert(TapeInventory, [
          { userId: meId, tapeType: 3, qty: 2 },
          { userId: meId, tapeType: 5, qty: 0 },
        ]);
        return purged;
      });

      for (const u of uploads) {
        const type = u.key.endsWith('.wav') ? 'audio/wav' : 'audio/mp4';
        await this.storage.upload(u.key, u.file, type);
      }
      await this.shelf.purgeFiles(purged);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    const { stored } = await this.shelf.counts(meId);
    return {
      friends: FRIENDS.length,
      stored,
      groups: GROUPS.length,
      sent: SENT.length,
      credits: 120,
    };
  }

  /** 이 사용자의 테이프·칸·친구·차단·원장·보유 테이프·광고 기록을 지운다 */
  private async reset(m: EntityManager, meId: string) {
    const recordings: Pick<Recording, 'id' | 'rawKey' | 'processedKey'>[] =
      await m
        .createQueryBuilder(Recording, 'r')
        .select(['r.id', 'r.rawKey', 'r.processedKey'])
        .leftJoin(Delivery, 'd', 'd.recording_id = r.id')
        .where(
          'd.recipient_id = :meId OR d.sender_id = :meId OR r.owner_id = :meId',
          { meId },
        )
        .getMany();
    if (recordings.length)
      await m.delete(Recording, { id: In(recordings.map((r) => r.id)) });
    await m.delete(ShelfGroup, { userId: meId });
    await m
      .createQueryBuilder()
      .delete()
      .from(Friendship)
      .where('user_id = :meId OR friend_id = :meId', { meId })
      .execute();
    await m
      .createQueryBuilder()
      .delete()
      .from(Block)
      .where('user_id = :meId OR blocked_id = :meId', { meId })
      .execute();
    await m.delete(CreditLedger, { userId: meId });
    await m.delete(TapeInventory, { userId: meId });
    await m.delete(AdReward, { userId: meId });
    return recordings;
  }

  /** 시드용 가짜 사용자. 같은 사용자·이름이면 재사용한다 */
  private async person(
    m: EntityManager,
    meId: string,
    name: string,
  ): Promise<string> {
    const providerSub = `seed:${meId}:${name}`;
    const existing = await m.findOneBy(AuthIdentity, {
      provider: 'dev',
      providerSub,
    });
    if (existing) return existing.userId;
    const user = await m.save(m.create(User, { name }));
    await m.insert(AuthIdentity, {
      userId: user.id,
      provider: 'dev',
      providerSub,
      email: null,
    });
    return user.id;
  }
}
