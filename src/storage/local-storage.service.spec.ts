import { ConfigService } from '@nestjs/config';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorageService } from './local-storage.service.js';

describe('LocalStorageService', () => {
  const service = new LocalStorageService(
    new ConfigService({
      LOCAL_STORAGE_DIR: mkdtempSync(join(tmpdir(), 'ls-')),
      JWT_SECRET: 'x'.repeat(40),
      PUBLIC_BASE_URL: 'http://192.168.0.10:3000/',
    }),
  );

  const parse = (url: string) => {
    const u = new URL(url);
    return {
      key: u.pathname.split('/').pop()!,
      exp: u.searchParams.get('exp') ?? undefined,
      ct: u.searchParams.get('ct') ?? undefined,
      sig: u.searchParams.get('sig') ?? undefined,
    };
  };

  it('서명한 URL은 검증을 통과하고, 바꾸면 실패한다', async () => {
    const put = await service.presignPut('recordings/u/r/raw', 'audio/mp4', 60);
    expect(
      put.url.startsWith('http://192.168.0.10:3000/api/dev-storage/'),
    ).toBe(true);
    const p = parse(put.url);
    expect(service.verify('put', p.key, p.exp, p.ct, p.sig)).toBe(
      'recordings/u/r/raw',
    );
    expect(service.verify('get', p.key, p.exp, p.ct, p.sig)).toBeNull();
    expect(service.verify('put', p.key, p.exp, 'audio/aac', p.sig)).toBeNull();
    expect(
      service.verify('put', p.key, String(Number(p.exp) + 1), p.ct, p.sig),
    ).toBeNull();
    expect(service.verify('put', p.key, '1', p.ct, p.sig)).toBeNull();
  });

  it('경로를 벗어나는 키는 거절한다', () => {
    expect(() => service.pathOf('../etc/passwd')).toThrow();
    expect(() => service.pathOf('a//b')).toThrow();
    expect(() => service.pathOf('a/b c')).toThrow();
    expect(service.pathOf('recordings/u/r/tape.m4a')).toContain(
      'recordings/u/r/tape.m4a',
    );
  });

  it('서명 변조는 모두 거절한다: 끝에 글자 추가, 홀수 길이, 대문자, 빈 문자열', async () => {
    const put = await service.presignPut('recordings/u/r/raw', 'audio/mp4', 60);
    const p = parse(put.url);
    const sig = p.sig!;
    expect(service.verify('put', p.key, p.exp, p.ct, sig)).toBe(
      'recordings/u/r/raw',
    );
    for (const bad of [
      `${sig}x`,
      `${sig}0`,
      sig.slice(0, -1),
      sig.toUpperCase(),
      '',
      `${sig.slice(0, -2)}zz`,
    ]) {
      expect(service.verify('put', p.key, p.exp, p.ct, bad)).toBeNull();
    }
    // 키 부분에 잘못된 글자를 붙여도 거절
    expect(service.verify('put', `${p.key}!`, p.exp, p.ct, sig)).toBeNull();
  });
});
