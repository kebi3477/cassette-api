import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

/**
 * 서랍 순서는 fractional indexing으로 관리한다 (base62 문자열, DB에서는 COLLATE "C"로 비교).
 * 옮길 때 그 줄 하나만 바뀐다.
 */
export function keyBetween(
  before: string | null,
  after: string | null,
): string {
  return generateKeyBetween(before, after);
}

export function keysBetween(
  before: string | null,
  after: string | null,
  n: number,
): string[] {
  return generateNKeysBetween(before, after, n);
}
