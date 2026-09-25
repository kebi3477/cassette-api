import { normalizeName } from './users.service.js';

describe('normalizeName', () => {
  it('앞뒤 공백을 뺀다', () => {
    expect(normalizeName('  민경 ')).toBe('민경');
  });

  it('8자까지 허용한다 (한글·이모지도 한 글자)', () => {
    expect(normalizeName('가나다라마바사아')).toBe('가나다라마바사아');
    expect(normalizeName('🎵🎵🎵🎵🎵🎵🎵🎵')).toHaveLength(16);
  });

  it('비었거나 8자를 넘으면 INVALID_NAME', () => {
    expect(() => normalizeName('   ')).toThrow(
      expect.objectContaining({ code: 'INVALID_NAME' }),
    );
    expect(() => normalizeName('가나다라마바사아자')).toThrow(
      expect.objectContaining({ code: 'INVALID_NAME' }),
    );
  });

  it('제어 문자는 거절한다', () => {
    expect(() => normalizeName('민\n경')).toThrow(
      expect.objectContaining({ code: 'INVALID_NAME' }),
    );
  });
});
