import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { TAGS, type Tag } from '../entities/delivery.entity.js';

export class CreateDeliveryDto {
  @IsUUID()
  recordingId: string;

  /** 친구에게 보낼 때. 생략하면 새 친구 링크로 보낸다 */
  @IsOptional()
  @IsUUID()
  recipientId?: string;

  /**
   * 새 친구 링크로 보낼 때 라벨에 적은 이름. 선택 입력이다.
   * 생략·null·빈 문자열이면 null로 저장하고(앱은 "새 친구"로 표시), 값이 있으면 1~8자.
   */
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(64)
  linkName?: string | null;

  /** 선택. 생략하거나 null이면 태그 없음 (디자인 v2에는 태그 화면이 없다) */
  @IsOptional()
  @IsIn(TAGS)
  tag?: Tag | null;
}
