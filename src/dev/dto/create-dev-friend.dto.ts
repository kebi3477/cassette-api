import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateDevFriendDto {
  /** 새 가짜 사용자를 이 이름으로 만들어 친구로 맺는다 (1~8자) */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;

  /** 이미 있는 사용자와 친구를 맺는다 (예: 다른 기기의 개발 계정). name과 둘 중 하나 */
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsBoolean()
  starred?: boolean;
}
