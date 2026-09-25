import { createHmac } from 'node:crypto';
import { decodeBase64Strict } from './strict-encoding.js';

/**
 * 탈퇴한 소셜 계정 식별자 해시. (provider, provider_sub)를 원문으로 남기지 않고
 * HMAC-SHA256(IDENTITY_HASH_KEY)만 남겨 재가입 제한에만 쓴다.
 */
export function hashIdentity(
  keyBase64: string,
  provider: string,
  sub: string,
): string {
  const key = decodeBase64Strict(keyBase64);
  if (!key) throw new Error('IDENTITY_HASH_KEY는 base64여야 합니다');
  return createHmac('sha256', key).update(`${provider}\n${sub}`).digest('hex');
}
