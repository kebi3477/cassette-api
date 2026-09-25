import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { AppException } from '../common/errors/app.exception.js';
import { renderErrorPage, renderTapePage, StoreLinks } from './link-page.js';
import { ShareService } from './share.service.js';

/**
 * `/api` 밖의 공개 경로: 링크 웹 페이지(`/t/{token}`)와 유니버설 링크·앱 링크 파일.
 * app.setup.ts에서 전역 prefix 제외로 등록한다.
 */
@Public()
@Controller()
export class LinkPageController {
  constructor(
    private readonly shareService: ShareService,
    private readonly config: ConfigService,
  ) {}

  @Get('t/:token')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @Header('X-Robots-Tag', 'noindex')
  async page(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const links = this.storeLinks();
    try {
      const preview = await this.shareService.webPreview(token);
      res.type('html').send(renderTapePage(token, preview, links));
    } catch (e) {
      if (!(e instanceof AppException)) throw e;
      res
        .status(e.getStatus())
        .type('html')
        .send(renderErrorPage(e.code, links));
    }
  }

  /** iOS 유니버설 링크 */
  @Get('.well-known/apple-app-site-association')
  appleAppSiteAssociation(@Res() res: Response): void {
    const appId = this.config.get<string>('APPLE_APP_ID');
    if (!appId) throw new AppException('NOT_FOUND');
    res.type('application/json').send({
      applinks: {
        details: [{ appIDs: [appId], components: [{ '/': '/t/*' }] }],
      },
    });
  }

  /** Android 앱 링크 */
  @Get('.well-known/assetlinks.json')
  assetLinks(@Res() res: Response): void {
    const pkg = this.config.get<string>('ANDROID_PACKAGE_NAME');
    const prints = (
      this.config.get<string>('ANDROID_SHA256_FINGERPRINTS') ?? ''
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!pkg || prints.length === 0) throw new AppException('NOT_FOUND');
    res.type('application/json').send([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: pkg,
          sha256_cert_fingerprints: prints,
        },
      },
    ]);
  }

  private storeLinks(): StoreLinks {
    return {
      appStore: this.config.getOrThrow<string>('APP_STORE_URL_IOS'),
      googlePlay: this.config.getOrThrow<string>('APP_STORE_URL_ANDROID'),
    };
  }
}
