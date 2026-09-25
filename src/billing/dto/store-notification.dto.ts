import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/** App Store Server Notifications V2 */
export class AppleNotificationDto {
  @IsString()
  @MaxLength(100_000)
  signedPayload: string;
}

/** Google Play RTDN (Cloud Pub/Sub 푸시) */
export class PubSubPushDto {
  @IsObject()
  message: { data?: string; messageId?: string; [k: string]: unknown };

  @IsOptional()
  @IsString()
  subscription?: string;

  @IsOptional()
  deliveryAttempt?: number;
}
