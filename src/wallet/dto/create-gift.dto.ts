import { IsInt, IsUUID } from 'class-validator';

export class CreateGiftDto {
  @IsUUID()
  toUserId: string;

  /** 10 · 30 · 50 · 100 (그 밖은 INVALID_GIFT_AMOUNT) */
  @IsInt()
  amount: number;
}
