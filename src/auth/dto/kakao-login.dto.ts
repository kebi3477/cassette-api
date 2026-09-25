import { IsString, MaxLength, MinLength } from 'class-validator';

export class KakaoLoginDto {
  /** 카카오 SDK가 준 액세스 토큰 */
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  accessToken: string;
}
