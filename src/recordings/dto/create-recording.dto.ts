import { IsIn, IsInt, Max, Min } from 'class-validator';
import { ALLOWED_CONTENT_TYPES } from '../recordings.constants.js';
import { TAPE_TYPES, type TapeType } from '../entities/recording.entity.js';

export class CreateRecordingDto {
  @IsIn(TAPE_TYPES)
  tapeType: TapeType;

  /** 녹음 길이(ms). 테이프 한도를 넘으면 RECORDING_TOO_LONG */
  @IsInt()
  @Min(500)
  @Max(3_600_000)
  durationMs: number;

  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType: string;
}
