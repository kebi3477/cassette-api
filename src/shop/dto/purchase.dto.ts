import { IsString, MaxLength } from 'class-validator';

export class PurchaseDto {
  /** tape60_1 · tape60_5 · tape180_1 · tape180_5 · drawer_10 */
  @IsString()
  @MaxLength(64)
  productId: string;
}
