import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TAGS, type Tag } from '../entities/delivery.entity.js';

export class CreateDeliveryDto {
  @IsUUID()
  recordingId: string;

  /** 친구에게 보낼 때. linkName과 둘 중 하나 */
  @IsOptional()
  @IsUUID()
  recipientId?: string;

  /** 새 친구에게 링크로 보낼 때 라벨에 적은 이름 (1~8자) */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  linkName?: string;

  /** 선택. 생략하거나 null이면 태그 없음 (디자인 v2에는 태그 화면이 없다) */
  @IsOptional()
  @IsIn(TAGS)
  tag?: Tag | null;
}
