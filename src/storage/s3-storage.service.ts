import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  PresignedUpload,
  PresignedUrl,
  StorageService,
  StoredObject,
} from './storage.service.js';

/**
 * S3 호환 저장소. endpoint·bucket·키를 환경 변수로 받아 MinIO와 Cloudflare R2 모두 쓴다.
 * presigned URL은 앱이 접속할 주소(S3_PUBLIC_ENDPOINT)로 서명한다.
 */
@Injectable()
export class S3StorageService extends StorageService implements OnModuleInit {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client;
  private readonly publicClient: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    super();
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    const endpoint = config.get<string>('S3_ENDPOINT') || undefined;
    const publicEndpoint = config.get<string>('S3_PUBLIC_ENDPOINT') || endpoint;
    this.client = this.createClient(endpoint);
    this.publicClient =
      publicEndpoint === endpoint
        ? this.client
        : this.createClient(publicEndpoint);
  }

  async onModuleInit(): Promise<void> {
    if (!this.config.get<boolean>('S3_CREATE_BUCKET')) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (e) {
      if (
        !(e instanceof S3ServiceException) ||
        e.$metadata.httpStatusCode !== 404
      ) {
        this.logger.warn(`버킷 확인 실패: ${String(e)}`);
        return;
      }
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`버킷을 만들었습니다: ${this.bucket}`);
    }
  }

  async presignPut(
    key: string,
    contentType: string,
    expiresInSec: number,
  ): Promise<PresignedUpload> {
    const url = await getSignedUrl(
      this.publicClient,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: expiresInSec },
    );
    return {
      url,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      expiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
    };
  }

  async presignGet(key: string, expiresInSec: number): Promise<PresignedUrl> {
    const url = await getSignedUrl(
      this.publicClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSec },
    );
    return {
      url,
      expiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
    };
  }

  async head(key: string): Promise<StoredObject | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        size: res.ContentLength ?? 0,
        contentType: res.ContentType ?? null,
      };
    } catch (e) {
      if (
        e instanceof NotFound ||
        (e instanceof S3ServiceException && e.$metadata.httpStatusCode === 404)
      ) {
        return null;
      }
      throw e;
    }
  }

  async download(key: string, filePath: string): Promise<void> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    await pipeline(res.Body as Readable, createWriteStream(filePath));
  }

  async upload(
    key: string,
    filePath: string,
    contentType: string,
  ): Promise<void> {
    const { size } = await stat(filePath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: createReadStream(filePath),
        ContentType: contentType,
        ContentLength: size,
      }),
    );
  }

  async delete(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    for (let i = 0; i < keys.length; i += 1000) {
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })),
            Quiet: true,
          },
        }),
      );
    }
  }

  private createClient(endpoint: string | undefined): S3Client {
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY');
    const secretAccessKey = this.config.get<string>('S3_SECRET_KEY');
    return new S3Client({
      endpoint,
      region: this.config.getOrThrow<string>('S3_REGION'),
      forcePathStyle: this.config.get<boolean>('S3_FORCE_PATH_STYLE') ?? true,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
      // R2·MinIO 호환: 요청에 체크섬 헤더를 억지로 넣지 않는다
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }
}
