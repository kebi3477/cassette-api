import type { DataSourceOptions } from 'typeorm';
import { migrations } from '../migrations/index.js';
import { entities } from './entities.js';

/** 앱과 마이그레이션 CLI가 함께 쓰는 TypeORM 설정. synchronize는 쓰지 않는다 */
export function buildDataSourceOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    // Postgres 13+ 내장 gen_random_uuid()를 쓴다 (uuid-ossp 확장 불필요)
    uuidExtension: 'pgcrypto',
    entities,
    migrations,
    migrationsTableName: 'migrations',
    synchronize: false,
    migrationsRun: false,
  };
}
