/**
 * 엄격한 16진·base64 해석. Node의 `Buffer.from(s, 'hex' | 'base64' | 'base64url')`는
 * 잘못된 글자를 조용히 버리거나 중간에서 멈추기 때문에, 서명·키·토큰을 비교하기 전에는 이 함수로 먼저 모양을 확인한다.
 */

/** 정확히 `bytes`바이트를 나타내는 소문자 16진 문자열이면 Buffer, 아니면 null */
export function decodeHexStrict(
  s: string | undefined,
  bytes: number,
): Buffer | null {
  if (typeof s !== 'string' || !new RegExp(`^[0-9a-f]{${bytes * 2}}$`).test(s))
    return null;
  return Buffer.from(s, 'hex');
}

/**
 * base64url(패딩 `=`는 있어도 되고 없어도 된다)이면 Buffer, 아니면 null.
 * 다시 인코딩했을 때 같은 문자열이 나와야 한다(남는 비트 장난 방지).
 */
export function decodeBase64UrlStrict(s: string | undefined): Buffer | null {
  if (typeof s !== 'string' || !/^[A-Za-z0-9_-]*={0,2}$/.test(s)) return null;
  const body = s.replace(/=+$/, '');
  if (body.length % 4 === 1) return null;
  const buf = Buffer.from(body, 'base64url');
  return buf.toString('base64url') === body ? buf : null;
}

/** 표준 base64(패딩 포함)이면 Buffer, 아니면 null. 다시 인코딩했을 때 같은 문자열이어야 한다 */
export function decodeBase64Strict(s: string | undefined): Buffer | null {
  if (
    typeof s !== 'string' ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(s) ||
    s.length % 4 !== 0
  ) {
    return null;
  }
  const buf = Buffer.from(s, 'base64');
  return buf.toString('base64') === s ? buf : null;
}
