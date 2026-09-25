import { validateEnv } from './env.validation.js';

const base = { DATABASE_URL: 'postgres://x/y', JWT_SECRET: 'a'.repeat(32) };
const prod = {
  ...base,
  NODE_ENV: 'production',
  KAKAO_APP_ID: '1',
  APPLE_CLIENT_IDS: 'app',
  S3_ACCESS_KEY: 'k',
  S3_SECRET_KEY: 's',
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
  IDENTITY_HASH_KEY: Buffer.alloc(32, 8).toString('base64'),
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

  it('IDENTITY_HASH_KEY: 운영 필수, TOKEN_ENCRYPTION_KEY와 달라야 한다. REJOIN_COOLDOWN_DAYS 기본 30', () => {
    expect(validateEnv(base).REJOIN_COOLDOWN_DAYS).toBe(30);
    expect(
      validateEnv({ ...base, REJOIN_COOLDOWN_DAYS: '7' }).REJOIN_COOLDOWN_DAYS,
    ).toBe(7);
    expect(() => validateEnv({ ...prod, IDENTITY_HASH_KEY: '' })).toThrow(
      /IDENTITY_HASH_KEY/,
    );
    expect(() =>
      validateEnv({ ...prod, IDENTITY_HASH_KEY: prod.TOKEN_ENCRYPTION_KEY }),
    ).toThrow(/IDENTITY_HASH_KEY/);
  });
});
