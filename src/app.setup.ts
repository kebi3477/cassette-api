import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

export const API_PREFIX = 'api';

/** main.ts와 e2e 테스트가 함께 쓰는 앱 설정. 전역 가드·파이프·필터는 CommonModule에 있다 */
export function setupApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix(API_PREFIX);
  // Cloudflare Tunnel 뒤에서 실제 클라이언트 IP를 쓰기 위해
  (app as NestExpressApplication).set('trust proxy', 1);
  app.enableShutdownHooks();
  return app;
}
