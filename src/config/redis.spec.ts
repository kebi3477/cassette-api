import { redisOptionsFromUrl } from './redis.js';

describe('redisOptionsFromUrl', () => {
  it('호스트·포트·비밀번호·db를 꺼낸다', () => {
    expect(redisOptionsFromUrl('redis://:p%40ss@redis:6380/2')).toMatchObject({
      host: 'redis',
      port: 6380,
      password: 'p@ss',
      db: 2,
      tls: undefined,
    });
    expect(redisOptionsFromUrl('rediss://h')).toMatchObject({
      port: 6379,
      tls: {},
    });
  });
});
