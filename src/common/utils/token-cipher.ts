import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** 32바이트 키를 base64 문자열에서 읽는다. 길이가 다르면 null */
export function parseEncryptionKey(base64: string | undefined): Buffer | null {
  if (!base64) return null;
  const key = Buffer.from(base64, 'base64');
  return key.length === 32 ? key : null;
}

/**
 * 저장하는 외부 토큰(Apple refresh token) 암호화. AES-256-GCM.
 * 키는 TOKEN_ENCRYPTION_KEY(32바이트 base64)로 받는다. 키를 바꾸면 이전에 저장한 토큰은 풀 수 없다(철회만 건너뛴다).
 */
export class TokenCipher {
  constructor(private readonly key: Buffer) {
    if (key.length !== 32)
      throw new Error('토큰 암호화 키는 32바이트여야 합니다');
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), data]
      .map((b) => b.toString('base64url'))
      .join('.');
  }

  decrypt(token: string): string | null {
    try {
      const [iv, tag, data] = token
        .split('.')
        .map((p) => Buffer.from(p, 'base64url'));
      const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString(
        'utf8',
      );
    } catch {
      return null;
    }
  }
}
