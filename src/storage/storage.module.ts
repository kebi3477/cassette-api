import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevStorageController } from './dev-storage.controller.js';
import { LocalStorageService } from './local-storage.service.js';
import { S3StorageService } from './s3-storage.service.js';
import { StorageService } from './storage.service.js';

@Global()
@Module({
  providers: [
    {
      provide: StorageService,
      inject: [ConfigService],
      // STORAGE_DRIVER=local은 개발 전용 (운영은 env 검증에서 막는다)
      useFactory: (config: ConfigService) =>
        config.get<string>('STORAGE_DRIVER') === 'local'
          ? new LocalStorageService(config)
          : new S3StorageService(config),
    },
  ],
  controllers: [DevStorageController],
  exports: [StorageService],
})
export class StorageModule {}
