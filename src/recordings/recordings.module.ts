import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Delivery } from '../deliveries/entities/delivery.entity.js';
import { Recording } from './entities/recording.entity.js';
import { FfmpegService } from './ffmpeg.service.js';
import { RECORDINGS_QUEUE } from './recordings.constants.js';
import { RecordingsController } from './recordings.controller.js';
import { RecordingsProcessor } from './recordings.processor.js';
import { RecordingsService } from './recordings.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Recording, Delivery]),
    BullModule.registerQueue({ name: RECORDINGS_QUEUE }),
  ],
  controllers: [RecordingsController],
  providers: [RecordingsService, RecordingsProcessor, FfmpegService],
  exports: [RecordingsService],
})
export class RecordingsModule {}
