import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  type AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator.js';
import type { ShelfItem } from '../deliveries/delivery.mapper.js';
import { CreateGroupDto } from './dto/create-group.dto.js';
import { MoveItemDto } from './dto/move-item.dto.js';
import type { GroupResponse, ShelfResponse } from './dto/shelf.response.js';
import { UpdateGroupDto } from './dto/update-group.dto.js';
import { ShelfService } from './shelf.service.js';

@Controller('shelf')
export class ShelfController {
  constructor(private readonly shelfService: ShelfService) {}

  @Get()
  get(@CurrentUser() user: AuthUser): Promise<ShelfResponse> {
    return this.shelfService.getShelf(user.id);
  }

  @Post('groups')
  createGroup(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateGroupDto,
  ): Promise<GroupResponse> {
    return this.shelfService.createGroup(user.id, dto);
  }

  @Patch('groups/:id')
  updateGroup(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGroupDto,
  ): Promise<GroupResponse> {
    return this.shelfService.updateGroup(user.id, id, dto);
  }

  @Delete('groups/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGroup(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.shelfService.deleteGroup(user.id, id);
  }

  @Patch('items/:id')
  moveItem(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveItemDto,
  ): Promise<ShelfItem> {
    return this.shelfService.moveItem(user.id, id, dto);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteItem(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.shelfService.deleteItem(user.id, id);
  }
}
