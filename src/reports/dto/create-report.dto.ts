import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  REPORT_REASONS,
  type ReportReason,
} from '../entities/report.entity.js';

/** 신고 대상. type이 tape면 deliveryId, user면 userId */
export class ReportTargetDto {
  @IsIn(['tape', 'user'])
  type: 'tape' | 'user';

  @ValidateIf((o: ReportTargetDto) => o.type === 'tape')
  @IsUUID()
  deliveryId?: string;

  @ValidateIf((o: ReportTargetDto) => o.type === 'user')
  @IsUUID()
  userId?: string;
}

export class CreateReportDto {
  @ValidateNested()
  @Type(() => ReportTargetDto)
  target: ReportTargetDto;

  @IsIn(REPORT_REASONS)
  reason: ReportReason;

  /** 선택, 최대 300자 */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;

  /** true면 같은 트랜잭션에서 대상(테이프면 보낸 사람)을 차단한다 */
  @IsOptional()
  @IsBoolean()
  alsoBlock?: boolean;
}
