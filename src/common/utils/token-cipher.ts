import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

/**
 * 저장하는 외부 토큰(Apple refresh token) 암호화. AES-256-GCM, 키는 JWT_SECRET에서 만든다.
 * JWT_SECRET을 바꾸면 이전에 저장한 토큰은 풀 수 없다 (철회만 건너뛴다).
 */
export class TokenCipher {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = createHash('sha256').update(`token-cipher:${secret}`).digest();
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
