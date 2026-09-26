import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/** 보낸 필드만 바꾼다. 둘 다 없으면 VALIDATION_FAILED */
export class UpdateFriendDto {
  /** 즐겨찾기 */
  @IsOptional()
  @IsBoolean()
  starred?: boolean;

  /**
   * 나에게만 보이는 별명 (최대 10자, 한글·이모지도 한 글자).
   * 빈 문자열이나 null이면 별명을 지운다. 규칙을 어기면 INVALID_NICKNAME
   */
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(100)
  nickname?: string | null;
}
