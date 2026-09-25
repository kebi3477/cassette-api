import type { PaidTapeType } from '../users/entities/tape-inventory.entity.js';

/** 가격표. 디자인 원본(CassetteApp.logic.js)의 shopTapes · etc · charge와 같다 */
export interface TapeProduct {
  id: string;
  tapeType: PaidTapeType;
  qty: number;
  name: string;
  price: number;
}

export interface DrawerProduct {
  id: string;
  name: string;
  slots: number;
  price: number;
}

export interface CreditPack {
  /** App Store Connect / Play Console 상품 ID (소비성) */
  productId: string;
  credits: number;
  priceKrw: number;
  priceLabel: string;
}

export const TAPE_PRODUCTS: TapeProduct[] = [
  { id: 'tape3_1', tapeType: 3, qty: 1, name: '3분 테이프', price: 30 },
  { id: 'tape3_5', tapeType: 3, qty: 5, name: '3분 테이프 5개', price: 120 },
  { id: 'tape5_1', tapeType: 5, qty: 1, name: '5분 테이프', price: 50 },
  { id: 'tape5_5', tapeType: 5, qty: 5, name: '5분 테이프 5개', price: 200 },
];

export const DRAWER_PRODUCTS: DrawerProduct[] = [
  { id: 'drawer_10', name: '서랍 넓히기', slots: 10, price: 100 },
];

export const CREDIT_PACKS: CreditPack[] = [
  {
    productId: 'credits_100',
    credits: 100,
    priceKrw: 1100,
    priceLabel: '₩1,100',
  },
  {
    productId: 'credits_550',
    credits: 550,
    priceKrw: 5500,
    priceLabel: '₩5,500',
  },
  {
    productId: 'credits_1200',
    credits: 1200,
    priceKrw: 11000,
    priceLabel: '₩11,000',
  },
];

export const GIFT_AMOUNTS = [10, 30, 50, 100] as const;

export const AD_REWARD_CREDITS = 10;
export const AD_DAILY_LIMIT = 3;

/** 원장 사유 문구 (디자인 ledger 형식) */
export const LedgerReasons = {
  signupGift: '가입 선물',
  adReward: '광고 보상',
  tapePurchase: (p: TapeProduct) => `${p.name} 구매`,
  drawerExpand: '서랍 넓히기',
  charge: (pack: CreditPack) => `크레딧 충전 · ${pack.priceLabel}`,
  chargeRefund: (pack: CreditPack) => `크레딧 충전 취소 · ${pack.priceLabel}`,
  giftSent: (toName: string) => `${toName}님에게 선물`,
  giftReceived: (fromName: string) => `${fromName}님이 선물`,
};

export function findCreditPack(productId: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.productId === productId);
}
