import { Body, Controller, Post } from '@nestjs/common';
import {
  type AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator.js';
import { Idempotent } from '../common/decorators/idempotent.decorator.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { type ReportResponse, ReportsService } from './reports.service.js';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /** 신고 (테이프 / 사람). 24시간 안에 같은 대상을 다시 신고하면 기존 신고를 돌려준다 */
  @Post()
  @Idempotent()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReportDto,
  ): Promise<ReportResponse> {
    return this.reportsService.create(user.id, dto);
  }
}
