import { decodeCursor, encodeCursor } from './cursor.js';
import { kstDate } from './kst.js';
import { parseServiceAccount } from './service-account.js';
import { TokenCipher } from './token-cipher.js';

describe('공통 유틸', () => {
  it('kstDate: 한국 시간 자정 기준', () => {
    expect(kstDate(new Date('2026-09-24T14:59:59Z'))).toBe('2026-09-24');
    expect(kstDate(new Date('2026-09-24T15:00:00Z'))).toBe('2026-09-25');
  });

  it('커서 왕복, 잘못된 커서는 VALIDATION_FAILED', () => {
    const c = {
      at: '2026-09-25T00:00:00.000Z',
      id: '7347352a-f7a3-40fc-805d-49124654a208',
    };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(() => decodeCursor('bm9wZQ')).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }),
    );
  });

  it('TokenCipher: 같은 비밀로만 풀린다', () => {
    const a = new TokenCipher('secret-a');
    const enc = a.encrypt('apple-refresh-token');
    expect(enc).not.toContain('apple');
    expect(a.decrypt(enc)).toBe('apple-refresh-token');
    expect(new TokenCipher('secret-b').decrypt(enc)).toBeNull();
  });

  it('서비스 계정 JSON: 원문과 base64 모두', () => {
    const json = JSON.stringify({
      project_id: 'p',
      client_email: 'e',
      private_key: 'k',
    });
    expect(parseServiceAccount(json)?.project_id).toBe('p');
    expect(
      parseServiceAccount(Buffer.from(json).toString('base64'))?.client_email,
    ).toBe('e');
    expect(parseServiceAccount('{"a":1}')).toBeNull();
    expect(parseServiceAccount(undefined)).toBeNull();
  });
});
