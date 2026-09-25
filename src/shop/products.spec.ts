import { CREDIT_PACKS, LedgerReasons, TAPE_PRODUCTS } from './products.js';

describe('가격표·원장 문구 (디자인 원본과 같게)', () => {
  it('원장 문구', () => {
    expect(LedgerReasons.tapePurchase(TAPE_PRODUCTS[0])).toBe(
      '3분 테이프 구매',
    );
    expect(LedgerReasons.charge(CREDIT_PACKS[0])).toBe('크레딧 충전 · ₩1,100');
    expect(LedgerReasons.giftSent('지현')).toBe('지현님에게 선물');
    expect(LedgerReasons.giftReceived('지현')).toBe('지현님이 선물');
    expect(LedgerReasons.adReward).toBe('광고 보상');
    expect(LedgerReasons.signupGift).toBe('가입 선물');
  });
});
