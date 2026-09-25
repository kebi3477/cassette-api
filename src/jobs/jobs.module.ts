import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module.js';
import { ShelfModule } from '../shelf/shelf.module.js';
import { JobsService } from './jobs.service.js';

@Module({
  imports: [ShelfModule, BillingModule],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
