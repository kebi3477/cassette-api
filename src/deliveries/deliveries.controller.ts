import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  type AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator.js';
import { Idempotent } from '../common/decorators/idempotent.decorator.js';
import { DeliveriesService } from './deliveries.service.js';
import type { SentTape, ShelfItem } from './delivery.mapper.js';
import { CreateDeliveryDto } from './dto/create-delivery.dto.js';
import { ListSentDto } from './dto/list-sent.dto.js';

@Controller('deliveries')
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  /** 테이프 보내기 (친구 / 링크) */
  @Post()
  @Idempotent()
  send(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDeliveryDto,
  ): Promise<SentTape> {
    return this.deliveriesService.send(user.id, dto);
  }

  @Get('sent')
  listSent(
    @CurrentUser() user: AuthUser,
    @Query() query: ListSentDto,
  ): Promise<{ items: SentTape[]; nextCursor: string | null }> {
    return this.deliveriesService.listSent(user.id, query.cursor, query.limit);
  }

  @Get('sent/:id')
  getSent(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SentTape> {
    return this.deliveriesService.getSent(user.id, id);
  }

  /** 링크 다시 공유하기 */
  @Post('sent/:id/share')
  @HttpCode(HttpStatus.OK)
  reshare(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ url: string; expiresAt: string }> {
    return this.deliveriesService.reshare(user.id, id);
  }

  @Get(':id')
  getReceived(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ShelfItem> {
    return this.deliveriesService.getReceived(user.id, id);
  }

  /** 소포 뜯기 */
  @Post(':id/open')
  @HttpCode(HttpStatus.OK)
  open(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ShelfItem> {
    return this.deliveriesService.open(user.id, id);
  }

  /** 재생 URL (받는 사람만) */
  @Get(':id/audio')
  audio(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ url: string; expiresAt: string; durationMs: number }> {
    return this.deliveriesService.audio(user.id, id);
  }
}
