import { IsIn, IsOptional, Matches } from 'class-validator';

export class AppVersionQueryDto {
  @IsIn(['ios', 'android'])
  platform: 'ios' | 'android';

  /** 지금 앱 버전 (x.y.z). 주면 updateRequired / updateAvailable을 계산한다 */
  @IsOptional()
  @Matches(/^\d+\.\d+\.\d+$/)
  version?: string;
}
