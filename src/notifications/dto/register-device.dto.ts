import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDeviceDto {
  /** FCM 등록 토큰 */
  @IsString()
  @MinLength(16)
  @MaxLength(512)
  token: string;

  @IsIn(['ios', 'android'])
  platform: 'ios' | 'android';
}
