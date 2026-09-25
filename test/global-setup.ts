import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../src/config/typeorm.config.js';

/** cassette_test를 비우고 마이그레이션을 처음부터 적용한다 */
export default async function setup() {
  const url =
    process.env.TEST_DATABASE_URL ?? 'postgres://localhost:5432/cassette_test';
  if (!/cassette_test/.test(url)) {
    throw new Error(`e2e는 cassette_test DB에서만 돌린다: ${url}`);
  }
  const ds = new DataSource(buildDataSourceOptions(url));
  await ds.initialize();
  await ds.dropDatabase();
  await ds.runMigrations({ transaction: 'each' });
  await ds.destroy();
}
