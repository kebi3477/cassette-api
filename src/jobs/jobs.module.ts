import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { ShelfModule } from '../shelf/shelf.module.js';
import { JobsService } from './jobs.service.js';

@Module({
  imports: [ShelfModule, BillingModule, AuthModule],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
