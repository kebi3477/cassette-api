import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMeDto {
  /** 앞뒤 공백을 빼고 1~8자 (서비스에서 검사, 실패 시 INVALID_NAME) */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}
