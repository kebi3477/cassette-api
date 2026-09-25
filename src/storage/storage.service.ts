export interface PresignedUrl {
  url: string;
  expiresAt: string;
}

export interface PresignedUpload extends PresignedUrl {
  method: 'PUT';
  /** 업로드할 때 그대로 붙여야 하는 헤더 (서명에 들어간다) */
  headers: Record<string, string>;
}

export interface StoredObject {
  size: number;
  contentType: string | null;
}

/**
 * 녹음 파일 저장소. 운영은 S3 호환(MinIO, R2) 구현(S3StorageService)을 쓰고,
 * 테스트는 메모리 구현으로 바꾼다. DI 토큰으로 쓰는 추상 클래스다.
 */
export abstract class StorageService {
  abstract presignPut(
    key: string,
    contentType: string,
    expiresInSec: number,
  ): Promise<PresignedUpload>;

  abstract presignGet(key: string, expiresInSec: number): Promise<PresignedUrl>;

  /** 없으면 null */
  abstract head(key: string): Promise<StoredObject | null>;

  abstract download(key: string, filePath: string): Promise<void>;

  abstract upload(
    key: string,
    filePath: string,
    contentType: string,
  ): Promise<void>;

  /** 없는 키는 무시한다 */
  abstract delete(keys: string[]): Promise<void>;
}
