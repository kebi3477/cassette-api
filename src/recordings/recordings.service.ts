import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { AppException } from '../common/errors/app.exception.js';
import { Delivery } from '../deliveries/entities/delivery.entity.js';
import { StorageService } from '../storage/storage.service.js';
import { CreateRecordingDto } from './dto/create-recording.dto.js';
import {
  CreateRecordingResponse,
  RecordingResponse,
} from './dto/recording.response.js';
import { Recording } from './entities/recording.entity.js';
import {
  AUDIO_URL_TTL_SEC,
  CONVERT_JOB,
  ConvertJobData,
  DECLARED_TOLERANCE_MS,
  isWithinLimit,
  MAX_UPLOAD_BYTES,
  RECORDINGS_QUEUE,
  rawKeyFor,
  UPLOAD_URL_TTL_SEC,
} from './recordings.constants.js';

@Injectable()
export class RecordingsService {
  constructor(
    @InjectRepository(Recording)
    private readonly recordings: Repository<Recording>,
    @InjectRepository(Delivery)
    private readonly deliveries: Repository<Delivery>,
    @InjectQueue(RECORDINGS_QUEUE)
    private readonly queue: Queue<ConvertJobData>,
    private readonly storage: StorageService,
  ) {}

  /** 녹음 자리를 만들고 원본을 올릴 presigned PUT URL을 준다 */
  async create(
    ownerId: string,
    dto: CreateRecordingDto,
  ): Promise<CreateRecordingResponse> {
    if (!isWithinLimit(dto.tapeType, dto.durationMs, DECLARED_TOLERANCE_MS)) {
      throw new AppException('RECORDING_TOO_LONG');
    }
    const id = randomUUID();
    const recording = await this.recordings.save(
      this.recordings.create({
        id,
        ownerId,
        tapeType: dto.tapeType,
        durationMs: dto.durationMs,
        contentType: dto.contentType,
        status: 'uploading',
        rawKey: rawKeyFor(ownerId, id),
      }),
    );
    const upload = await this.storage.presignPut(
      recording.rawKey,
      dto.contentType,
      UPLOAD_URL_TTL_SEC,
    );
    return { ...(await this.toResponse(recording)), upload };
  }

  async get(ownerId: string, id: string): Promise<RecordingResponse> {
    return this.toResponse(await this.findOwned(ownerId, id));
  }

  /** 업로드가 끝났다는 알림. 파일을 확인하고 변환 큐에 넣는다. 이미 넘어간 상태면 그대로 돌려준다 */
  async complete(ownerId: string, id: string): Promise<RecordingResponse> {
    const recording = await this.findOwned(ownerId, id);
    if (recording.status !== 'uploading') return this.toResponse(recording);

    const object = await this.storage.head(recording.rawKey);
    if (!object) throw new AppException('UPLOAD_NOT_FOUND');
    if (object.size > MAX_UPLOAD_BYTES) {
      await this.storage.delete([recording.rawKey]);
      throw new AppException('RECORDING_TOO_LARGE');
    }
    return this.startProcessing(recording, 'uploading');
  }

  /** 변환 실패한 녹음을 다시 변환한다. 실패 상태가 아니면 그대로 돌려준다 */
  async retry(ownerId: string, id: string): Promise<RecordingResponse> {
    const recording = await this.findOwned(ownerId, id);
    if (recording.status !== 'failed') return this.toResponse(recording);
    return this.startProcessing(recording, 'failed');
  }

  private async startProcessing(
    recording: Recording,
    from: 'uploading' | 'failed',
  ): Promise<RecordingResponse> {
    // 동시에 두 번 와도 한 번만 큐에 넣는다
    const result = await this.recordings.update(
      { id: recording.id, status: from },
      { status: 'processing', failureReason: null },
    );
    if (result.affected) {
      await this.queue.add(
        CONVERT_JOB,
        { recordingId: recording.id },
        {
          jobId: `${recording.id}-${Date.now()}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    }
    return this.get(recording.ownerId!, recording.id);
  }

  private async findOwned(ownerId: string, id: string): Promise<Recording> {
    const recording = await this.recordings.findOneBy({ id, ownerId });
    if (!recording || recording.purgedAt) {
      throw new AppException('RECORDING_NOT_FOUND');
    }
    return recording;
  }

  private async toResponse(recording: Recording): Promise<RecordingResponse> {
    let preview: RecordingResponse['preview'] = null;
    if (recording.status === 'ready' && recording.processedKey) {
      const sent = await this.deliveries.existsBy({
        recordingId: recording.id,
      });
      if (!sent) {
        preview = await this.storage.presignGet(
          recording.processedKey,
          AUDIO_URL_TTL_SEC,
        );
      }
    }
    return {
      id: recording.id,
      tapeType: recording.tapeType,
      durationMs: recording.durationMs,
      status: recording.status,
      preview,
    };
  }
}
