import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class DevLoginDto {
  /** 개발용 계정 키. 같은 키로 로그인하면 같은 사용자다 */
  @Matches(/^[A-Za-z0-9_-]{1,64}$/)
  key: string;

  /** 새로 만들 때 이름 (1~8자). 없으면 이름 정하기 화면부터 */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;
}
