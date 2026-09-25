import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
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

  /** BullMQ(변환 큐)용 Redis */
  @IsString()
  @Matches(/^rediss?:\/\//)
  REDIS_URL: string = 'redis://localhost:6379';

  /** BullMQ 키 접두어. 테스트와 개발 서버가 같은 Redis를 써도 섞이지 않게 */
  @IsString()
  BULLMQ_PREFIX: string = 'cassette';

  /** S3 호환 저장소(MinIO, R2). 비우면 AWS S3 기본 주소 */
  @IsOptional()
  @IsUrl({ require_tld: false })
  S3_ENDPOINT?: string;

  /** 앱이 presigned URL로 접속할 주소. 컨테이너 안 주소(S3_ENDPOINT)와 다를 때 */
  @IsOptional()
  @IsUrl({ require_tld: false })
  S3_PUBLIC_ENDPOINT?: string;

  @IsString()
  S3_REGION: string = 'us-east-1';

  @IsString()
  S3_BUCKET: string = 'cassette';

  @IsOptional()
  @IsString()
  S3_ACCESS_KEY?: string;

  @IsOptional()
  @IsString()
  S3_SECRET_KEY?: string;

  /** MinIO는 path-style이 필요하다 */
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  S3_FORCE_PATH_STYLE: boolean = true;

  /** 시작할 때 버킷이 없으면 만든다 (MinIO 개발·운영 편의) */
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  S3_CREATE_BUCKET: boolean = false;

  /** 링크 주소의 앞부분. 예: https://cassette.app → https://cassette.app/t/{token} */
  @IsUrl({ require_tld: false })
  PUBLIC_BASE_URL: string = 'http://localhost:3000';

  @IsString()
  FFMPEG_PATH: string = 'ffmpeg';

  @IsString()
  FFPROBE_PATH: string = 'ffprobe';

  /** 유니버설 링크(apple-app-site-association)용 "<TEAM ID>.<번들 ID>" */
  @IsOptional()
  @IsString()
  APPLE_APP_ID?: string;

  /** 앱 링크(assetlinks.json)용 안드로이드 패키지 이름 */
  @IsOptional()
  @IsString()
  ANDROID_PACKAGE_NAME?: string;

  /** 앱 링크용 서명 인증서 SHA-256 지문. 쉼표로 구분 */
  @IsOptional()
  @IsString()
  ANDROID_SHA256_FINGERPRINTS?: string;

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
    const missing = (
      [
        'KAKAO_APP_ID',
        'APPLE_CLIENT_IDS',
        'S3_ACCESS_KEY',
        'S3_SECRET_KEY',
      ] as const
    ).filter((k) => !env[k]);
    if (missing.length > 0) {
      throw new Error(
        `운영 환경에 필요한 환경 변수가 없습니다: ${missing.join(', ')}`,
      );
    }
  }
  return env;
}
