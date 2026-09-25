import type {
  PresignedUpload,
  PresignedUrl,
} from '../../storage/storage.service.js';
import type {
  RecordingStatus,
  TapeType,
} from '../entities/recording.entity.js';

export interface RecordingResponse {
  id: string;
  tapeType: TapeType;
  durationMs: number;
  status: RecordingStatus;
  /** 변환이 끝났고 아직 보내지 않았을 때만. 녹음한 사람의 미리 듣기용 */
  preview: PresignedUrl | null;
}

export interface CreateRecordingResponse extends RecordingResponse {
  upload: PresignedUpload;
}
