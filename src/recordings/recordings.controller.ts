import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  type AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator.js';
import { CreateRecordingDto } from './dto/create-recording.dto.js';
import type {
  CreateRecordingResponse,
  RecordingResponse,
} from './dto/recording.response.js';
import { RecordingsService } from './recordings.service.js';

@Controller('recordings')
export class RecordingsController {
  constructor(private readonly recordingsService: RecordingsService) {}

  /** 녹음 업로드 URL 발급 */
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateRecordingDto,
  ): Promise<CreateRecordingResponse> {
    return this.recordingsService.create(user.id, dto);
  }

  /** 변환 상태 + 미리 듣기 URL */
  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RecordingResponse> {
    return this.recordingsService.get(user.id, id);
  }

  /** 업로드 완료 → 변환 시작 */
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RecordingResponse> {
    return this.recordingsService.complete(user.id, id);
  }

  /** 변환 다시 시도 */
  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  retry(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RecordingResponse> {
    return this.recordingsService.retry(user.id, id);
  }
}
