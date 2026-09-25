import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AppleLoginDto {
  /** sign_in_with_apple이 준 identityToken (JWT) */
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  identityToken: string;

  /** sign_in_with_apple의 authorizationCode. 주면 탈퇴 때 Apple 토큰 철회에 쓴다 (권장) */
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  authorizationCode?: string;

  /** Apple에 sha256(nonce)를 넘겼다면 원문 nonce */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  nonce?: string;
}
