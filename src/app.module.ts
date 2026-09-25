import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppVersionModule } from './app-version/app-version.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CommonModule } from './common/common.module.js';
import { validateEnv } from './config/env.validation.js';
import { redisOptionsFromUrl } from './config/redis.js';
import { buildDataSourceOptions } from './config/typeorm.config.js';
import { DevModule } from './dev/dev.module.js';
import { FriendsModule } from './friends/friends.module.js';
import { UsersModule } from './users/users.module.js';
import { WalletModule } from './wallet/wallet.module.js';
import { RecordingsModule } from './recordings/recordings.module.js';
import { DeliveriesModule } from './deliveries/deliveries.module.js';
import { ShareModule } from './share/share.module.js';
import { ShelfModule } from './shelf/shelf.module.js';
import { StorageModule } from './storage/storage.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      // 테스트는 환경 변수만 쓴다 (.env의 개발 DB를 건드리지 않게)
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildDataSourceOptions(config.getOrThrow<string>('DATABASE_URL')),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisOptionsFromUrl(config.getOrThrow<string>('REDIS_URL')),
        prefix: config.getOrThrow<string>('BULLMQ_PREFIX'),
      }),
    }),
    CommonModule,
    StorageModule,
    NotificationsModule,
    AppVersionModule,
    AuthModule,
    UsersModule,
    FriendsModule,
    WalletModule,
    DevModule,
    RecordingsModule,
    DeliveriesModule,
    ShareModule,
    ShelfModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
