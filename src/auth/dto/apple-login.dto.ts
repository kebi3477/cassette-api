import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AppleLoginDto {
  /** sign_in_with_apple이 준 identityToken (JWT) */
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  identityToken: string;

  /** Apple에 sha256(nonce)를 넘겼다면 원문 nonce */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  nonce?: string;
}
