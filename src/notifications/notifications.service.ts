import { Injectable, Logger } from '@nestjs/common';

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

/**
 * 푸시 발송 자리. 3단계에서 FCM을 붙인다.
 * 지금은 호출 지점만 두고 로그만 남긴다. 트랜잭션이 끝난 뒤에 부르고, 실패해도 요청을 실패시키지 않는다.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  /** "{보낸 사람}님이 테이프를 보냈어요" (받는 사람의 notificationsEnabled를 확인해서 보낸다) */
  async tapeDelivered(event: TapeDeliveredEvent): Promise<void> {
    this.logger.debug(`[푸시 예정] 테이프 도착 ${JSON.stringify(event)}`);
    await Promise.resolve();
  }

  /** "{이름}님이 테이프를 받았어요" */
  async linkClaimed(event: LinkClaimedEvent): Promise<void> {
    this.logger.debug(`[푸시 예정] 링크 받음 ${JSON.stringify(event)}`);
    await Promise.resolve();
  }
}
