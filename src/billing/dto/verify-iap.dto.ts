import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IAP_STORES, type IapStore } from '../entities/iap-purchase.entity.js';

export class VerifyIapDto {
  @IsIn(IAP_STORES)
  store: IapStore;

  /** tapeletter.credits_100 · tapeletter.credits_550 · tapeletter.credits_1200 */
  @IsString()
  @MaxLength(64)
  productId: string;

  /** 참고용 (서버는 검증한 값을 쓴다) */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  transactionId?: string;

  /** iOS: StoreKit 2 jwsRepresentation · Android: purchaseToken */
  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  verificationData: string;
}
