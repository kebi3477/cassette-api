import { decodeCursor, encodeCursor } from './cursor.js';
import { hashIdentity } from './identity-hash.js';
import { kstDate } from './kst.js';
import { parseServiceAccount } from './service-account.js';
import { parseEncryptionKey, TokenCipher } from './token-cipher.js';

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

  it('TokenCipher: 같은 키로만 풀린다', () => {
    const keyA = Buffer.alloc(32, 1);
    const a = new TokenCipher(keyA);
    const enc = a.encrypt('apple-refresh-token');
    expect(enc).not.toContain('apple');
    expect(a.decrypt(enc)).toBe('apple-refresh-token');
    expect(new TokenCipher(Buffer.alloc(32, 2)).decrypt(enc)).toBeNull();
    expect(() => new TokenCipher(Buffer.alloc(16))).toThrow();
  });

  it('parseEncryptionKey: 32바이트 base64만', () => {
    expect(
      parseEncryptionKey(Buffer.alloc(32, 7).toString('base64'))?.length,
    ).toBe(32);
    expect(parseEncryptionKey(Buffer.alloc(16).toString('base64'))).toBeNull();
    expect(parseEncryptionKey(undefined)).toBeNull();
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

  it('hashIdentity: 같은 키·계정이면 같은 해시, 원문은 남지 않는다', () => {
    const key = Buffer.alloc(32, 3).toString('base64');
    const h = hashIdentity(key, 'kakao', '12345');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashIdentity(key, 'kakao', '12345'));
    expect(h).not.toBe(hashIdentity(key, 'apple', '12345'));
    expect(h).not.toBe(
      hashIdentity(Buffer.alloc(32, 4).toString('base64'), 'kakao', '12345'),
    );
  });
});
