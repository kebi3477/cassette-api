import { plainToInstance, Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

const SEMVER = /^\d+\.\d+\.\d+$/;

export class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  /** postgres://user:password@host:5432/db */
  @IsString()
  @Matches(/^postgres(ql)?:\/\//)
  DATABASE_URL: string;

  @IsOptional()
  @IsString()
  REDIS_URL?: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  /** access token 수명(초) */
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(60)
  JWT_ACCESS_TTL: number = 3600;

  /** refresh token 수명(초) */
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(3600)
  JWT_REFRESH_TTL: number = 60 * 60 * 24 * 60;

  /** 카카오 앱 ID. 액세스 토큰이 우리 앱에서 발급됐는지 확인한다 */
  @IsOptional()
  @IsString()
  KAKAO_APP_ID?: string;

  /** Apple identity token의 aud로 허용할 값(번들 ID, Service ID). 쉼표로 구분 */
  @IsOptional()
  @IsString()
  APPLE_CLIENT_IDS?: string;

  /** 가입 선물 크레딧 */
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  SIGNUP_GIFT_CREDITS: number = 10;

  @Matches(SEMVER)
  APP_MIN_VERSION_IOS: string = '1.0.0';

  @Matches(SEMVER)
  APP_LATEST_VERSION_IOS: string = '1.0.0';

  @IsUrl()
  APP_STORE_URL_IOS: string = 'https://apps.apple.com/app/id0000000000';

  @Matches(SEMVER)
  APP_MIN_VERSION_ANDROID: string = '1.0.0';

  @Matches(SEMVER)
  APP_LATEST_VERSION_ANDROID: string = '1.0.0';

  @IsUrl()
  APP_STORE_URL_ANDROID: string =
    'https://play.google.com/store/apps/details?id=app.cassette';
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, {
    exposeDefaultValues: true,
  });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const detail = errors
      .map(
        (e) =>
          `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
      )
      .join('\n');
    throw new Error(`환경 변수가 올바르지 않습니다.\n${detail}`);
  }
  if (env.NODE_ENV === 'production') {
    const missing = (['KAKAO_APP_ID', 'APPLE_CLIENT_IDS'] as const).filter(
      (k) => !env[k],
    );
    if (missing.length > 0) {
      throw new Error(
        `운영 환경에 필요한 환경 변수가 없습니다: ${missing.join(', ')}`,
      );
    }
  }
  return env;
}
