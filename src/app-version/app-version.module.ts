import { Module } from '@nestjs/common';
import { AppVersionService } from './app-version.service.js';
import { AppVersionController } from './app-version.controller.js';

@Module({
  controllers: [AppVersionController],
  providers: [AppVersionService],
})
export class AppVersionModule {}
