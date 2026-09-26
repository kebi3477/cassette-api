import {
  DECLARED_TOLERANCE_MS,
  isWithinLimit,
  processedKeyFor,
  rawKeyFor,
  TAPE_LIMIT_MS,
  TAPE_NAMES,
} from './recordings.constants.js';

describe('녹음 한도', () => {
  it('종류 코드가 곧 초: 15초 15,000ms, 1분 60,000ms, 3분 180,000ms', () => {
    expect(TAPE_LIMIT_MS).toEqual({ 15: 15_000, 60: 60_000, 180: 180_000 });
    expect(TAPE_NAMES).toEqual({ 15: '15초', 60: '1분', 180: '3분' });
  });

  it('오차까지는 허용하고 넘으면 거절한다', () => {
    expect(isWithinLimit(15, 16_000, DECLARED_TOLERANCE_MS)).toBe(true);
    expect(isWithinLimit(15, 16_001, DECLARED_TOLERANCE_MS)).toBe(false);
    expect(isWithinLimit(60, 61_000, DECLARED_TOLERANCE_MS)).toBe(true);
    expect(isWithinLimit(60, 61_001, DECLARED_TOLERANCE_MS)).toBe(false);
    expect(isWithinLimit(180, 181_000, DECLARED_TOLERANCE_MS)).toBe(true);
    expect(isWithinLimit(180, 181_001, DECLARED_TOLERANCE_MS)).toBe(false);
  });

  it('파일 키는 사용자/녹음 아래에 둔다', () => {
    expect(rawKeyFor('u', 'r')).toBe('recordings/u/r/raw');
    expect(processedKeyFor('u', 'r')).toBe('recordings/u/r/tape.m4a');
  });
});
