import dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './typeorm.config.js';

/**
 * TypeORM CLI용 DataSource. 빌드된 `dist/config/data-source.js`를 쓴다.
 * package.json의 migration:* 스크립트 참고.
 */
dotenv.config({ quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL 환경 변수가 없습니다');
}

export default new DataSource(buildDataSourceOptions(url));
