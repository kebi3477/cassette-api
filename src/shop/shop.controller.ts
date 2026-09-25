import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import {
  type AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator.js';
import { Idempotent } from '../common/decorators/idempotent.decorator.js';
import { PurchaseDto } from './dto/purchase.dto.js';
import { type PurchaseResponse, ShopService } from './shop.service.js';

@Controller('shop')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  /** 상품 목록 (가격은 서버가 정한다) */
  @Get('products')
  products(): ReturnType<ShopService['products']> {
    return this.shopService.products();
  }

  /** 테이프 사기 / 서랍 넓히기 */
  @Post('purchases')
  @Idempotent()
  purchase(
    @CurrentUser() user: AuthUser,
    @Body() dto: PurchaseDto,
    @Headers('idempotency-key') key: string,
  ): Promise<PurchaseResponse> {
    return this.shopService.purchase(user.id, dto.productId, key);
  }
}
