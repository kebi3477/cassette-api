import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthIdentity } from '../auth/entities/auth-identity.entity.js';
import { Friendship } from '../friends/entities/friendship.entity.js';
import { TapeInventory } from './entities/tape-inventory.entity.js';
import { User } from './entities/user.entity.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, TapeInventory, AuthIdentity, Friendship]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
