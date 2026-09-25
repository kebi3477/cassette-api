import type { RedisOptions } from 'bullmq';

/** REDIS_URL(redis://[:비밀번호@]호스트:포트[/db])을 BullMQ 연결 옵션으로 바꾼다 */
export function redisOptionsFromUrl(url: string): RedisOptions {
  const u = new URL(url);
  const db = u.pathname.replace('/', '');
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    username: u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: db ? Number(db) : undefined,
    tls: u.protocol === 'rediss:' ? {} : undefined,
  };
}
