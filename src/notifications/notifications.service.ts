import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { DeviceToken } from './entities/device-token.entity.js';
import { FcmService, PushMessage } from './fcm.service.js';

export interface TapeDeliveredEvent {
  deliveryId: string;
  recipientId: string;
  senderName: string;
  tapeType: 1 | 3 | 5;
}

export interface LinkClaimedEvent {
  deliveryId: string;
  senderId: string;
  recipientName: string;
}

export interface GiftReceivedEvent {
  recipientId: string;
  senderName: string;
  amount: number;
}

/**
 * 푸시 알림. 문구는 docs/api.md "푸시 모양"과 같다.
 * 받는 사람의 notificationsEnabled가 false면 보내지 않는다. 무효 토큰은 지운다.
 * 호출하는 쪽은 트랜잭션이 끝난 뒤 부르고, 실패해도 요청을 실패시키지 않는다.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly fcm: FcmService,
  ) {}

  async registerDevice(
    userId: string,
    token: string,
    platform: 'ios' | 'android',
  ) {
    await this.dataSource.manager.upsert(
      DeviceToken,
      { token, userId, platform, updatedAt: new Date() },
      ['token'],
    );
  }

  async unregisterDevice(userId: string, token: string): Promise<void> {
    await this.dataSource.manager.delete(DeviceToken, { token, userId });
  }

  tapeDelivered(e: TapeDeliveredEvent): Promise<void> {
    return this.push(e.recipientId, {
      title: `${e.senderName}님이 테이프를 보냈어요`,
      body: `${e.tapeType}분 테이프가 도착했어요. 뜯어서 들어보세요`,
      data: { type: 'tape', deliveryId: e.deliveryId },
    });
  }

  linkClaimed(e: LinkClaimedEvent): Promise<void> {
    return this.push(e.senderId, {
      title: `${e.recipientName}님이 테이프를 받았어요`,
      body: '이제 서로 친구예요',
      data: { type: 'claimed', deliveryId: e.deliveryId },
    });
  }

  giftReceived(e: GiftReceivedEvent): Promise<void> {
    return this.push(e.recipientId, {
      title: `${e.senderName}님이 크레딧을 선물했어요`,
      body: `${e.amount} 크레딧을 받았어요`,
      data: { type: 'gift' },
    });
  }

  private async push(userId: string, message: PushMessage): Promise<void> {
    const user = await this.dataSource.manager.findOne(User, {
      where: { id: userId },
      select: { id: true, notificationsEnabled: true },
    });
    if (!user?.notificationsEnabled) return;
    const devices = await this.dataSource.manager.findBy(DeviceToken, {
      userId,
    });
    for (const d of devices) {
      try {
        const result = await this.fcm.send(d.token, message);
        if (result === 'invalid') {
          await this.dataSource.manager.delete(DeviceToken, { token: d.token });
          this.logger.log(`무효 FCM 토큰 정리: ${d.token.slice(0, 12)}…`);
        }
      } catch (e) {
        this.logger.error(`푸시 실패: ${String(e)}`);
      }
    }
  }
}
