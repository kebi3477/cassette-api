import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthIdentity } from '../auth/entities/auth-identity.entity.js';
import { Delivery } from '../deliveries/entities/delivery.entity.js';
import { FriendsModule } from '../friends/friends.module.js';
import { ShelfModule } from '../shelf/shelf.module.js';
import { TapeInventory } from './entities/tape-inventory.entity.js';
import { User } from './entities/user.entity.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, TapeInventory, AuthIdentity, Delivery]),
    FriendsModule,
    ShelfModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
