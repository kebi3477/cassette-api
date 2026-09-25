import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShelfModule } from '../shelf/shelf.module.js';
import { User } from '../users/entities/user.entity.js';
import { Block } from './entities/block.entity.js';
import { Friendship } from './entities/friendship.entity.js';
import { FriendsController } from './friends.controller.js';
import { FriendsService } from './friends.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Friendship, Block, User]), ShelfModule],
  controllers: [FriendsController],
  providers: [FriendsService],
  exports: [FriendsService],
})
export class FriendsModule {}
