import { validateEnv } from './env.validation.js';

const base = { DATABASE_URL: 'postgres://x/y', JWT_SECRET: 'a'.repeat(32) };
const prod = {
  ...base,
  NODE_ENV: 'production',
  KAKAO_APP_ID: '1',
  APPLE_CLIENT_IDS: 'app',
  S3_ACCESS_KEY: 'k',
  S3_SECRET_KEY: 's',
};

describe('validateEnv', () => {
  it('개발 기본값', () => {
    const env = validateEnv(base);
    expect(env).toMatchObject({
      PORT: 3000,
      STORAGE_DRIVER: 's3',
      FFMPEG_MODE: 'real',
      SIGNUP_GIFT_CREDITS: 10,
    });
  });

  it('운영에서는 local 저장소·passthrough·제한 끄기를 막는다', () => {
    expect(() => validateEnv(prod)).not.toThrow();
    expect(() => validateEnv({ ...prod, STORAGE_DRIVER: 'local' })).toThrow(
      /STORAGE_DRIVER/,
    );
    expect(() => validateEnv({ ...prod, FFMPEG_MODE: 'passthrough' })).toThrow(
      /FFMPEG_MODE/,
    );
    expect(() => validateEnv({ ...prod, THROTTLE_DISABLED: 'true' })).toThrow(
      /THROTTLE_DISABLED/,
    );
    expect(() => validateEnv({ ...prod, S3_SECRET_KEY: '' })).toThrow(
      /S3_SECRET_KEY/,
    );
  });
});
