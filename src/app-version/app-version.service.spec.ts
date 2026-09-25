import { ConfigService } from '@nestjs/config';
import { AppVersionService, compareVersions } from './app-version.service.js';

describe('AppVersionService', () => {
  const config = new ConfigService({
    APP_MIN_VERSION_IOS: '1.2.0',
    APP_LATEST_VERSION_IOS: '1.4.1',
    APP_STORE_URL_IOS: 'https://apps.apple.com/app/id1',
    APP_MIN_VERSION_ANDROID: '1.0.0',
    APP_LATEST_VERSION_ANDROID: '1.0.0',
    APP_STORE_URL_ANDROID: 'https://play.google.com/store/apps/details?id=x',
  });
  const service = new AppVersionService(config);

  it('버전을 숫자로 비교한다', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0);
    expect(compareVersions('0.9.0', '1.0.0')).toBeLessThan(0);
  });

  it('최소 버전보다 낮으면 강제 업데이트', () => {
    const r = service.get({ platform: 'ios', version: '1.1.9' });
    expect(r).toMatchObject({
      minVersion: '1.2.0',
      latestVersion: '1.4.1',
      updateRequired: true,
      updateAvailable: true,
    });
  });

  it('최소 버전 이상이면 강제 업데이트가 아니다', () => {
    const r = service.get({ platform: 'ios', version: '1.2.0' });
    expect(r.updateRequired).toBe(false);
    expect(r.updateAvailable).toBe(true);
  });

  it('version이 없으면 판정하지 않는다', () => {
    const r = service.get({ platform: 'android' });
    expect(r.updateRequired).toBeNull();
    expect(r.storeUrl).toContain('play.google.com');
  });
});
