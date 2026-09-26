import { normalizeNickname } from './display-text.js';

describe('normalizeNickname', () => {
  it('앞뒤 공백을 빼고 10자까지 (한글·이모지도 한 글자)', () => {
    expect(normalizeNickname('  동민이 ')).toBe('동민이');
    expect(normalizeNickname('가나다라마바사아자차')).toBe(
      '가나다라마바사아자차',
    );
    expect(normalizeNickname('🎵🎵🎵🎵🎵🎵🎵🎵🎵🎵')).toHaveLength(20);
  });

  it('빈 값·null이면 지운다(null)', () => {
    expect(normalizeNickname('')).toBeNull();
    expect(normalizeNickname('   ')).toBeNull();
    expect(normalizeNickname(null)).toBeNull();
  });

  it('10자 초과·제어 문자는 INVALID_NICKNAME', () => {
    expect(() => normalizeNickname('가나다라마바사아자차카')).toThrow(
      expect.objectContaining({ code: 'INVALID_NICKNAME' }),
    );
    expect(() => normalizeNickname('줄\n바꿈')).toThrow(
      expect.objectContaining({ code: 'INVALID_NICKNAME' }),
    );
  });
});
