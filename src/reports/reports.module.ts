import { Module } from '@nestjs/common';
import { FriendsModule } from '../friends/friends.module.js';
import { ReportNotifierService } from './report-notifier.service.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [FriendsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportNotifierService],
  exports: [ReportsService],
})
export class ReportsModule {}
