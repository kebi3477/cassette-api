import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository } from 'typeorm';
import { StorageService } from '../storage/storage.service.js';
import { Recording } from './entities/recording.entity.js';
import { FfmpegService } from './ffmpeg.service.js';
import {
  ConvertJobData,
  isWithinLimit,
  MEASURED_TOLERANCE_MS,
  PROCESSED_CONTENT_TYPE,
  processedKeyFor,
  RECORDINGS_QUEUE,
} from './recordings.constants.js';

/**
 * 변환 워커. 원본을 받아 ffmpeg로 "테이프 소리"로 바꾸고 결과를 올린다.
 * 마지막 시도까지 실패하면 녹음을 failed로 바꾼다 (앱: 변환 실패 화면 → retry).
 */
@Processor(RECORDINGS_QUEUE, { concurrency: 2 })
export class RecordingsProcessor extends WorkerHost {
  private readonly logger = new Logger(RecordingsProcessor.name);

  constructor(
    @InjectRepository(Recording)
    private readonly recordings: Repository<Recording>,
    private readonly storage: StorageService,
    private readonly ffmpeg: FfmpegService,
  ) {
    super();
  }

  async process(job: Job<ConvertJobData>): Promise<void> {
    const recording = await this.recordings.findOneBy({
      id: job.data.recordingId,
    });
    if (!recording || recording.status !== 'processing' || recording.purgedAt) {
      return; // 지워졌거나 이미 끝난 녹음
    }
    try {
      await this.convert(recording);
    } catch (e) {
      const last = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      this.logger.warn(
        `변환 실패 ${recording.id} (시도 ${job.attemptsMade + 1}): ${String(e)}`,
      );
      if (last) await this.fail(recording.id, String(e).slice(0, 255));
      throw e;
    }
  }

  private async convert(recording: Recording): Promise<void> {
    const dir = await mkdtemp(join(tmpdir(), 'cassette-'));
    try {
      const input = join(dir, 'raw');
      const output = join(dir, 'tape.m4a');
      await this.storage.download(recording.rawKey, input);
      await this.ffmpeg.convertToTape(input, output);
      // passthrough 모드는 길이를 재지 않으므로 앱이 알린 길이를 쓴다
      const durationMs =
        (await this.ffmpeg.probeDurationMs(output)) ?? recording.durationMs;
      if (
        !isWithinLimit(recording.tapeType, durationMs, MEASURED_TOLERANCE_MS)
      ) {
        await this.fail(recording.id, `too_long:${durationMs}`);
        return;
      }
      const key = processedKeyFor(recording.ownerId ?? 'orphan', recording.id);
      const contentType = this.ffmpeg.passthrough
        ? recording.contentType
        : PROCESSED_CONTENT_TYPE;
      await this.storage.upload(key, output, contentType);
      const result = await this.recordings.update(
        { id: recording.id, status: 'processing' },
        { status: 'ready', processedKey: key, durationMs, failureReason: null },
      );
      // 변환이 끝났으니 원본은 지운다 (retry는 failed일 때만 원본을 쓴다). 실패해도 ready는 유지한다
      if (result.affected) await this.deleteRaw(recording);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  /** 원본 파일 삭제. 실패하면 경고만 남기고, 정리 작업(jobs/)이 다시 지운다 */
  private async deleteRaw(recording: Recording): Promise<void> {
    try {
      await this.storage.delete([recording.rawKey]);
      await this.recordings.update(recording.id, { rawDeletedAt: new Date() });
    } catch (e) {
      this.logger.warn(`원본 파일 삭제 실패 ${recording.id}: ${String(e)}`);
    }
  }

  private async fail(id: string, reason: string): Promise<void> {
    await this.recordings.update(
      { id, status: 'processing' },
      { status: 'failed', failureReason: reason },
    );
  }
}
