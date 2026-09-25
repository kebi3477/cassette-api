import { keyBetween, keysBetween } from './position.js';
import { normalizeGroupName } from './shelf.service.js';

/** DB의 COLLATE "C"와 같은 바이트 순서 비교 */
const byteOrder = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

describe('fractional index', () => {
  it('두 키 사이의 키를 만든다', () => {
    const a = keyBetween(null, null);
    const c = keyBetween(a, null);
    const b = keyBetween(a, c);
    expect([c, a, b].sort(byteOrder)).toEqual([a, b, c]);
  });

  it('맨 앞에 계속 넣어도 순서가 유지된다', () => {
    let first: string | null = null;
    const keys: string[] = [];
    for (let i = 0; i < 50; i++) {
      first = keyBetween(null, first);
      keys.unshift(first);
    }
    expect([...keys].sort(byteOrder)).toEqual(keys);
  });

  it('n개를 한 번에 만든다', () => {
    const keys = keysBetween('a0', null, 3);
    expect(keys).toHaveLength(3);
    expect([...keys].sort(byteOrder)).toEqual(keys);
    expect(keys[0] > 'a0').toBe(true);
  });
});

describe('normalizeGroupName', () => {
  it('비우면 "새 칸", 12자까지', () => {
    expect(normalizeGroupName('  ')).toBe('새 칸');
    expect(normalizeGroupName(' 2026 생일 ')).toBe('2026 생일');
    expect(normalizeGroupName('가'.repeat(12))).toHaveLength(12);
    expect(() => normalizeGroupName('가'.repeat(13))).toThrow(
      expect.objectContaining({ code: 'INVALID_GROUP_NAME' }),
    );
  });
});
