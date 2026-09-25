import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  decodeBase64UrlStrict,
  decodeHexStrict,
} from '../common/utils/strict-encoding.js';
import { createWriteStream } from 'node:fs';
import {
  copyFile,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import {
  PresignedUpload,
  PresignedUrl,
  StorageService,
  StoredObject,
} from './storage.service.js';

export type LocalOp = 'put' | 'get';

const KEY_PATTERN = /^[A-Za-z0-9_.\-/]+$/;

export class FileTooLargeError extends Error {}

/**
 * 개발 전용 저장소 (STORAGE_DRIVER=local). 파일을 디스크에 두고,
 * 앱은 API의 서명된 URL(`/api/dev-storage/{key}?op=&exp=&ct=&sig=`)로 올리고 받는다.
 * 운영에서는 env 검증이 local을 막고, dev-storage 라우트는 404다.
 */
export class LocalStorageService extends StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  readonly root: string;
  private readonly secret: Buffer;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    super();
    this.root = resolve(config.getOrThrow<string>('LOCAL_STORAGE_DIR'));
    this.secret = createHash('sha256')
      .update(`dev-storage:${config.getOrThrow<string>('JWT_SECRET')}`)
      .digest();
    this.baseUrl = config
      .getOrThrow<string>('PUBLIC_BASE_URL')
      .replace(/\/+$/, '');
    this.logger.log(`로컬 저장소 사용: ${this.root}`);
  }

  presignPut(
    key: string,
    contentType: string,
    ttl: number,
  ): Promise<PresignedUpload> {
    const { url, expiresAt } = this.signedUrl('put', key, ttl, contentType);
    return Promise.resolve({
      url,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      expiresAt,
    });
  }

  presignGet(key: string, ttl: number): Promise<PresignedUrl> {
    return Promise.resolve(this.signedUrl('get', key, ttl, ''));
  }

  async head(key: string): Promise<StoredObject | null> {
    try {
      const s = await stat(this.pathOf(key));
      return { size: s.size, contentType: await this.contentTypeOf(key) };
    } catch {
      return null;
    }
  }

  async download(key: string, filePath: string): Promise<void> {
    await copyFile(this.pathOf(key), filePath);
  }

  async upload(
    key: string,
    filePath: string,
    contentType: string,
  ): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await copyFile(filePath, path);
    await writeFile(`${path}.meta.json`, JSON.stringify({ contentType }));
  }

  async delete(keys: string[]): Promise<void> {
    for (const key of keys) {
      const path = this.pathOf(key);
      await rm(path, { force: true });
      await rm(`${path}.meta.json`, { force: true });
    }
  }

  /** 서명된 PUT 요청 본문을 파일로 쓴다. maxBytes를 넘으면 FileTooLargeError */
  async writeStream(
    key: string,
    contentType: string,
    body: Readable,
    maxBytes: number,
  ): Promise<number> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    let size = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        size += chunk.length;
        if (size > maxBytes) cb(new FileTooLargeError());
        else cb(null, chunk);
      },
    });
    try {
      await pipeline(body, limiter, createWriteStream(path));
    } catch (e) {
      await rm(path, { force: true });
      throw e;
    }
    await writeFile(`${path}.meta.json`, JSON.stringify({ contentType }));
    return size;
  }

  async contentTypeOf(key: string): Promise<string | null> {
    try {
      const meta = JSON.parse(
        await readFile(`${this.pathOf(key)}.meta.json`, 'utf8'),
      ) as {
        contentType?: string;
      };
      return meta.contentType ?? null;
    } catch {
      return null;
    }
  }

  /**
   * 서명 검증. 맞으면 키를, 틀리거나 만료됐으면 null을 준다.
   */
  verify(
    op: LocalOp,
    encodedKey: string,
    exp: string | undefined,
    ct: string | undefined,
    sig: string | undefined,
  ): string | null {
    if (!exp || !sig || !/^\d+$/.test(exp)) return null;
    if (Number(exp) * 1000 < Date.now()) return null;
    // 서명은 정확히 32바이트 소문자 16진(64자)이어야 한다.
    // Buffer.from(…, 'hex')는 잘못된 글자를 조용히 버려서, 끝에 글자를 붙여도 통과하던 문제가 있었다
    const given = decodeHexStrict(sig, 32);
    const keyBytes = decodeBase64UrlStrict(encodedKey);
    if (!given || !keyBytes) return null;
    const key = keyBytes.toString('utf8');
    try {
      this.pathOf(key);
    } catch {
      return null;
    }
    const expected = Buffer.from(this.sign(op, key, exp, ct ?? ''), 'hex');
    if (!timingSafeEqual(given, expected)) return null;
    return key;
  }

  pathOf(key: string): string {
    if (
      !KEY_PATTERN.test(key) ||
      key.split('/').some((p) => p === '..' || p === '')
    ) {
      throw new Error(`잘못된 저장소 키: ${key}`);
    }
    return join(this.root, key);
  }

  private sign(op: LocalOp, key: string, exp: string, ct: string): string {
    return createHmac('sha256', this.secret)
      .update(`${op}\n${key}\n${exp}\n${ct}`)
      .digest('hex');
  }

  private signedUrl(
    op: LocalOp,
    key: string,
    ttl: number,
    ct: string,
  ): PresignedUrl {
    this.pathOf(key);
    const exp = String(Math.floor(Date.now() / 1000) + ttl);
    const qs = new URLSearchParams({
      op,
      exp,
      ct,
      sig: this.sign(op, key, exp, ct),
    });
    if (!ct) qs.delete('ct');
    return {
      url: `${this.baseUrl}/api/dev-storage/${Buffer.from(key).toString('base64url')}?${qs}`,
      expiresAt: new Date(Number(exp) * 1000).toISOString(),
    };
  }
}
