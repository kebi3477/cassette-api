import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * e2e는 로컬 Postgres의 cassette_test DB를 쓴다 (TEST_DATABASE_URL로 바꿀 수 있다).
 * globalSetup이 스키마를 비우고 마이그레이션을 처음부터 적용한다.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgres://localhost:5432/cassette_test',
      JWT_SECRET: 'e2e-test-secret-e2e-test-secret-0123456789',
      APPLE_CLIENT_IDS: 'app.cassette',
      KAKAO_APP_ID: '1234',
    },
  },
});
