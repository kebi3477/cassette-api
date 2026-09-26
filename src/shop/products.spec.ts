import { CREDIT_PACKS, LedgerReasons, TAPE_PRODUCTS } from './products.js';

describe('가격표·원장 문구 (디자인 원본과 같게)', () => {
  it('원장 문구', () => {
    expect(LedgerReasons.tapePurchase(TAPE_PRODUCTS[0])).toBe(
      '1분 테이프 구매',
    );
    expect(LedgerReasons.tapePurchase(TAPE_PRODUCTS[3])).toBe(
      '3분 테이프 5개 구매',
    );
    expect(LedgerReasons.charge(CREDIT_PACKS[0])).toBe('크레딧 충전 · ₩1,100');
    expect(LedgerReasons.giftSent('지현')).toBe('지현님에게 선물');
    expect(LedgerReasons.giftReceived('지현')).toBe('지현님이 선물');
    expect(LedgerReasons.adReward).toBe('광고 보상');
    expect(LedgerReasons.signupGift).toBe('가입 선물');
  });

  it('테이프 상품: 1분·3분만 판다 (15초는 무료)', () => {
    expect(
      TAPE_PRODUCTS.map(({ id, tapeType, qty, name, price }) => [
        id,
        tapeType,
        qty,
        name,
        price,
      ]),
    ).toEqual([
      ['tape60_1', 60, 1, '1분 테이프', 30],
      ['tape60_5', 60, 5, '1분 테이프 5개', 120],
      ['tape180_1', 180, 1, '3분 테이프', 50],
      ['tape180_5', 180, 5, '3분 테이프 5개', 200],
    ]);
  });

  it('크레딧 팩 상품 ID는 App Store·Google Play 규칙에 맞는다', () => {
    expect(CREDIT_PACKS.map((p) => p.productId)).toEqual([
      'tapeletter.credits_100',
      'tapeletter.credits_550',
      'tapeletter.credits_1200',
    ]);
    for (const { productId } of CREDIT_PACKS) {
      // Google Play: 소문자·숫자로 시작, 소문자·숫자·_·.만, 최대 139자 / App Store: 영숫자·_·.
      expect(productId).toMatch(/^[a-z0-9][a-z0-9_.]{0,138}$/);
    }
  });
});
