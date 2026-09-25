import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class DevCreditsDto {
  /** ad: 광고 보상 흉내(하루 3회) · charge: 크레딧 팩 충전 흉내 · admin: 임의 금액 */
  @IsIn(['ad', 'charge', 'admin'])
  type: 'ad' | 'charge' | 'admin';

  /** type=charge: credits_100 · credits_550 · credits_1200 */
  @IsOptional()
  @IsString()
  productId?: string;

  /** type=admin: 1~100000 */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  amount?: number;
}
