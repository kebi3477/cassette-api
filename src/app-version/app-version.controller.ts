import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { AppVersionService } from './app-version.service.js';
import { AppVersionQueryDto } from './dto/app-version-query.dto.js';
import type { AppVersionResponse } from './dto/app-version.response.js';

@Controller('app-version')
export class AppVersionController {
  constructor(private readonly appVersionService: AppVersionService) {}

  /** 강제 업데이트 확인. 앱 시작 시 로그인 전에 부른다 */
  @Public()
  @Get()
  get(@Query() query: AppVersionQueryDto): AppVersionResponse {
    return this.appVersionService.get(query);
  }
}
