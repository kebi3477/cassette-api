import { copyFile, readFile, writeFile } from 'node:fs/promises';
import type {
  PresignedUpload,
  PresignedUrl,
  StoredObject,
} from '../src/storage/storage.service.js';
import { StorageService } from '../src/storage/storage.service.js';

/** 메모리 저장소. presigned URL 대신 `memory://` 주소를 주고, 테스트가 put()으로 업로드를 흉내 낸다 */
export class InMemoryStorage extends StorageService {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  put(key: string, body: Buffer, contentType = 'audio/mp4'): void {
    this.objects.set(key, { body, contentType });
  }

  /** presigned URL에서 키를 꺼낸다 */
  keyOf(url: string): string {
    return decodeURIComponent(new URL(url).pathname.slice(1));
  }

  presignPut(
    key: string,
    contentType: string,
    ttl: number,
  ): Promise<PresignedUpload> {
    return Promise.resolve({
      url: `memory://bucket/${encodeURIComponent(key)}?op=put`,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    });
  }

  presignGet(key: string, ttl: number): Promise<PresignedUrl> {
    return Promise.resolve({
      url: `memory://bucket/${encodeURIComponent(key)}?op=get`,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    });
  }

  head(key: string): Promise<StoredObject | null> {
    const o = this.objects.get(key);
    return Promise.resolve(
      o ? { size: o.body.length, contentType: o.contentType } : null,
    );
  }

  async download(key: string, filePath: string): Promise<void> {
    const o = this.objects.get(key);
    if (!o) throw new Error(`없는 키: ${key}`);
    await writeFile(filePath, o.body);
  }

  async upload(
    key: string,
    filePath: string,
    contentType: string,
  ): Promise<void> {
    this.put(key, await readFile(filePath), contentType);
  }

  delete(keys: string[]): Promise<void> {
    keys.forEach((k) => this.objects.delete(k));
    return Promise.resolve();
  }
}

/** ffmpeg 대신 파일을 그대로 복사하고, 길이는 정해 둔 값을 준다 */
export class FakeFfmpeg {
  durationMs = 4200;
  fail = false;

  isAvailable() {
    return Promise.resolve(true);
  }

  async convertToTape(input: string, output: string): Promise<void> {
    if (this.fail) throw new Error('가짜 ffmpeg 실패');
    await copyFile(input, output);
  }

  probeDurationMs(): Promise<number> {
    return Promise.resolve(this.durationMs);
  }
}
