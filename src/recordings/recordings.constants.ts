import type { TapeType } from './entities/recording.entity.js';

export const RECORDINGS_QUEUE = 'recordings';
export const CONVERT_JOB = 'convert';

export interface ConvertJobData {
  recordingId: string;
}

/** 테이프별 녹음 한도(ms): 1분 60초, 3분 180초, 5분 300초 */
export const TAPE_LIMIT_MS: Record<TapeType, number> = {
  1: 60_000,
  3: 180_000,
  5: 300_000,
};

/** 앱이 알린 길이의 허용 오차 (정지 버튼 지연 등) */
export const DECLARED_TOLERANCE_MS = 1_000;
/** 변환 후 실제 길이의 허용 오차 (인코더 패딩) */
export const MEASURED_TOLERANCE_MS = 1_500;

export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
export const UPLOAD_URL_TTL_SEC = 15 * 60;
export const AUDIO_URL_TTL_SEC = 10 * 60;

export const ALLOWED_CONTENT_TYPES = [
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
] as const;

export const PROCESSED_CONTENT_TYPE = 'audio/mp4';

export function isWithinLimit(
  tapeType: TapeType,
  durationMs: number,
  tolerance: number,
): boolean {
  return durationMs <= TAPE_LIMIT_MS[tapeType] + tolerance;
}

export function rawKeyFor(ownerId: string, recordingId: string): string {
  return `recordings/${ownerId}/${recordingId}/raw`;
}

export function processedKeyFor(ownerId: string, recordingId: string): string {
  return `recordings/${ownerId}/${recordingId}/tape.m4a`;
}
