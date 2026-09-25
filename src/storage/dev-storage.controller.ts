import {
  Controller,
  Get,
  Param,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { AppException } from '../common/errors/app.exception.js';
import { DevOnlyGuard } from '../common/guards/dev-only.guard.js';
import { MAX_UPLOAD_BYTES } from '../recordings/recordings.constants.js';
import {
  FileTooLargeError,
  LocalStorageService,
} from './local-storage.service.js';
import { StorageService } from './storage.service.js';

interface SignedQuery {
  op?: string;
  exp?: string;
  ct?: string;
  sig?: string;
}

/**
 * 개발용 로컬 저장소의 서명된 URL (STORAGE_DRIVER=local일 때만).
 * 운영이나 s3 드라이버에서는 404다. 로그인 대신 HMAC 서명과 만료로 확인한다.
 */
@Public()
@UseGuards(DevOnlyGuard)
@Controller('dev-storage')
export class DevStorageController {
  constructor(private readonly storage: StorageService) {}

  @Put(':key')
  async put(
    @Param('key') encodedKey: string,
    @Query() q: SignedQuery,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const local = this.local();
    const key =
      q.op === 'put'
        ? local.verify('put', encodedKey, q.exp, q.ct, q.sig)
        : null;
    if (!key) throw new AppException('INVALID_SIGNATURE');
    const contentType = (req.header('content-type') ?? '').split(';')[0].trim();
    if (contentType !== q.ct) throw new AppException('INVALID_SIGNATURE');
    try {
      await local.writeStream(key, contentType, req, MAX_UPLOAD_BYTES * 2);
    } catch (e) {
      if (e instanceof FileTooLargeError)
        throw new AppException('RECORDING_TOO_LARGE');
      throw e;
    }
    res.status(200).end();
  }

  @Get(':key')
  async get(
    @Param('key') encodedKey: string,
    @Query() q: SignedQuery,
    @Res() res: Response,
  ): Promise<void> {
    const local = this.local();
    const key =
      q.op === 'get'
        ? local.verify('get', encodedKey, q.exp, undefined, q.sig)
        : null;
    if (!key) throw new AppException('INVALID_SIGNATURE');
    const object = await local.head(key);
    if (!object) throw new AppException('NOT_FOUND');
    res.type(object.contentType ?? 'application/octet-stream');
    // Range 요청(오디오 탐색)도 sendFile이 처리한다
    res.sendFile(local.pathOf(key), { dotfiles: 'allow' });
  }

  private local(): LocalStorageService {
    if (!(this.storage instanceof LocalStorageService)) {
      throw new AppException('NOT_FOUND');
    }
    return this.storage;
  }
}
