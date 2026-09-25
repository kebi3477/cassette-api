import {
  decodeBase64Strict,
  decodeBase64UrlStrict,
  decodeHexStrict,
} from './strict-encoding.js';

describe('엄격한 인코딩 해석', () => {
  const hex = 'ab'.repeat(32);

  it('16진: 정확한 길이의 소문자만', () => {
    expect(decodeHexStrict(hex, 32)?.length).toBe(32);
    expect(decodeHexStrict(`${hex}x`, 32)).toBeNull(); // 끝에 글자 추가
    expect(decodeHexStrict(hex.slice(0, 63), 32)).toBeNull(); // 홀수 길이
    expect(decodeHexStrict(hex.toUpperCase(), 32)).toBeNull(); // 대문자
    expect(decodeHexStrict('', 32)).toBeNull(); // 빈 문자열
    expect(decodeHexStrict(undefined, 32)).toBeNull();
    expect(decodeHexStrict(`${hex}ab`, 32)).toBeNull(); // 길이 초과
  });

  it('base64url: 허용 글자와 다시 인코딩한 값이 같아야 한다', () => {
    const s = Buffer.from('recordings/u/r/raw').toString('base64url');
    expect(decodeBase64UrlStrict(s)?.toString()).toBe('recordings/u/r/raw');
    expect(decodeBase64UrlStrict(`${s}!`)).toBeNull();
    expect(decodeBase64UrlStrict(`${s}.`)).toBeNull();
    expect(decodeBase64UrlStrict('a')).toBeNull();
    expect(decodeBase64UrlStrict('QR')).toBeNull(); // 남는 비트가 0이 아님
    expect(decodeBase64UrlStrict('QQ==')?.toString()).toBe('A');
  });

  it('base64: 패딩까지 정확해야 한다', () => {
    const key = Buffer.alloc(32, 5).toString('base64');
    expect(decodeBase64Strict(key)?.length).toBe(32);
    expect(decodeBase64Strict(`${key}x`)).toBeNull();
    expect(decodeBase64Strict(key.replace(/=$/, ''))).toBeNull();
    expect(decodeBase64Strict('c2hvcnQ$')).toBeNull();
  });
});
