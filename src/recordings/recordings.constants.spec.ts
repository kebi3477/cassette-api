import {
  DECLARED_TOLERANCE_MS,
  isWithinLimit,
  processedKeyFor,
  rawKeyFor,
  TAPE_LIMIT_MS,
} from './recordings.constants.js';

describe('녹음 한도', () => {
  it('1분 60초, 3분 180초, 5분 300초', () => {
    expect(TAPE_LIMIT_MS).toEqual({ 1: 60_000, 3: 180_000, 5: 300_000 });
  });

  it('오차까지는 허용하고 넘으면 거절한다', () => {
    expect(isWithinLimit(1, 61_000, DECLARED_TOLERANCE_MS)).toBe(true);
    expect(isWithinLimit(1, 61_001, DECLARED_TOLERANCE_MS)).toBe(false);
    expect(isWithinLimit(5, 300_500, DECLARED_TOLERANCE_MS)).toBe(true);
  });

  it('파일 키는 사용자/녹음 아래에 둔다', () => {
    expect(rawKeyFor('u', 'r')).toBe('recordings/u/r/raw');
    expect(processedKeyFor('u', 'r')).toBe('recordings/u/r/tape.m4a');
  });
});
