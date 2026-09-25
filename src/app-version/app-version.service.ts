import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppVersionQueryDto } from './dto/app-version-query.dto.js';
import { AppVersionResponse } from './dto/app-version.response.js';

/** a < b 이면 음수, 같으면 0, a > b 이면 양수 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

@Injectable()
export class AppVersionService {
  constructor(private readonly config: ConfigService) {}

  get({ platform, version }: AppVersionQueryDto): AppVersionResponse {
    const p = platform === 'ios' ? 'IOS' : 'ANDROID';
    const minVersion = this.config.getOrThrow<string>(`APP_MIN_VERSION_${p}`);
    const latestVersion = this.config.getOrThrow<string>(
      `APP_LATEST_VERSION_${p}`,
    );
    const storeUrl = this.config.getOrThrow<string>(`APP_STORE_URL_${p}`);
    return {
      platform,
      minVersion,
      latestVersion,
      storeUrl,
      updateRequired: version ? compareVersions(version, minVersion) < 0 : null,
      updateAvailable: version
        ? compareVersions(version, latestVersion) < 0
        : null,
    };
  }
}
