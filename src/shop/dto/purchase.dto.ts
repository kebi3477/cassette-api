import { IsString, MaxLength } from 'class-validator';

export class PurchaseDto {
  /** tape3_1 · tape3_5 · tape5_1 · tape5_5 · drawer_10 */
  @IsString()
  @MaxLength(64)
  productId: string;
}
