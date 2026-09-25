import { INestApplication } from '@nestjs/common';
import { generateKeyPairSync, sign } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { AuthResponse } from '../src/auth/dto/auth.response.js';
import { AdmobService } from '../src/billing/admob.service.js';
import {
  appStore,
  bearer,
  createApp,
  devLogin,
  googlePlay,
  idem,
} from './utils.js';

describe('billing (e2e)', () => {
  let app: INestApplication<App>;
  const server = () => app.getHttpServer();
  const as = (u: AuthResponse) => bearer(u.accessToken);
  const wallet = (u: AuthResponse) =>
    request(server())
      .get('/api/wallet')
      .set(as(u))
      .expect(200)
      .then((r) => r.body);

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(() => app.close());
  afterEach(() => {
    appStore.enabled = true;
    googlePlay.enabled = true;
  });

  const iap = (u: AuthResponse, body: Record<string, unknown>) =>
    request(server())
      .post('/api/billing/iap')
      .set(as(u))
      .set(idem())
      .send(body);

  describe('인앱 결제', () => {
    it('키가 없으면 503 IAP_UNAVAILABLE', async () => {
      appStore.enabled = false;
      const u = await devLogin(app, '결제');
      const res = await iap(u, {
        store: 'app_store',
        productId: 'credits_100',
        verificationData: JSON.stringify({
          transactionId: 't-0',
          productId: 'credits_100',
        }),
      }).expect(503);
      expect(res.body.code).toBe('IAP_UNAVAILABLE');
    });

    it('App Store: 지급 → 같은 결제 다시 보내면 지급 없음 → 다른 계정은 거절', async () => {
      const u = await devLogin(app, '애플');
      const jws = JSON.stringify({
        transactionId: `apple-${Date.now()}`,
        productId: 'credits_550',
      });
      const first = await iap(u, {
        store: 'app_store',
        productId: 'credits_550',
        verificationData: jws,
      }).expect(200);
      expect(first.body).toMatchObject({
        credits: 560,
        granted: 550,
        alreadyProcessed: false,
        entry: { delta: 550, reason: '크레딧 충전 · ₩5,500', kind: 'iap' },
      });
      const again = await iap(u, {
        store: 'app_store',
        productId: 'credits_550',
        verificationData: jws,
      }).expect(200);
      expect(again.body).toMatchObject({
        credits: 560,
        granted: 0,
        alreadyProcessed: true,
      });

      const other = await devLogin(app, '남');
      const stolen = await iap(other, {
        store: 'app_store',
        productId: 'credits_550',
        verificationData: jws,
      }).expect(409);
      expect(stolen.body.code).toBe('RECEIPT_ALREADY_USED');
      expect((await wallet(other)).credits).toBe(10);
    });

    it('동시에 같은 결제를 보내도 한 번만 지급', async () => {
      const u = await devLogin(app, '동시결제');
      const jws = JSON.stringify({
        transactionId: `apple-c-${Date.now()}`,
        productId: 'credits_100',
      });
      const results = await Promise.all(
        Array.from({ length: 4 }, () =>
          iap(u, {
            store: 'app_store',
            productId: 'credits_100',
            verificationData: jws,
          }),
        ),
      );
      expect(results.every((r) => r.status === 200)).toBe(true);
      expect(results.filter((r) => r.body.granted === 100)).toHaveLength(1);
      expect((await wallet(u)).credits).toBe(110);
    });

    it('상품이 다르거나 환불된 결제는 RECEIPT_INVALID', async () => {
      const u = await devLogin(app, '이상');
      const mismatch = await iap(u, {
        store: 'app_store',
        productId: 'credits_1200',
        verificationData: JSON.stringify({
          transactionId: 'x1',
          productId: 'credits_100',
        }),
      }).expect(400);
      expect(mismatch.body.code).toBe('RECEIPT_INVALID');
      await iap(u, {
        store: 'app_store',
        productId: 'credits_100',
        verificationData: JSON.stringify({
          transactionId: 'x2',
          productId: 'credits_100',
          revoked: true,
        }),
      }).expect(400);
    });

    it('Google Play: 대기 중이면 409, 구매됨이면 지급 후 consume', async () => {
      const u = await devLogin(app, '안드');
      googlePlay.purchases.set('tok-pending', {
        orderId: 'GPA.pending',
        purchaseState: 2,
        consumptionState: 0,
      });
      const pending = await iap(u, {
        store: 'play',
        productId: 'credits_100',
        verificationData: 'tok-pending',
      }).expect(409);
      expect(pending.body.code).toBe('RECEIPT_PENDING');

      googlePlay.purchases.set('tok-ok', {
        orderId: `GPA.${Date.now()}`,
        purchaseState: 0,
        consumptionState: 0,
      });
      const ok = await iap(u, {
        store: 'play',
        productId: 'credits_100',
        verificationData: 'tok-ok',
      }).expect(200);
      expect(ok.body.granted).toBe(100);
      expect(googlePlay.consumed).toContain('tok-ok');
    });

    it('환불(App Store 알림 REFUND): 잔액 안에서 회수하고 음수로 만들지 않는다', async () => {
      const u = await devLogin(app, '환불');
      const tx = `apple-r-${Date.now()}`;
      await iap(u, {
        store: 'app_store',
        productId: 'credits_100',
        verificationData: JSON.stringify({
          transactionId: tx,
          productId: 'credits_100',
        }),
      }).expect(200); // 110
      await request(server())
        .post('/api/shop/purchases')
        .set(as(u))
        .set(idem())
        .send({ productId: 'tape5_1' })
        .expect(201); // 60

      await request(server())
        .post('/api/billing/apple/notifications')
        .send({
          signedPayload: JSON.stringify({
            notificationType: 'REFUND',
            subtype: null,
            transaction: {
              transactionId: tx,
              productId: 'credits_100',
              environment: 'Sandbox',
              revoked: true,
            },
          }),
        })
        .expect(200);
      expect((await wallet(u)).credits).toBe(0);
      const ledger = await request(server())
        .get('/api/wallet/ledger')
        .set(as(u))
        .expect(200);
      expect(ledger.body.items[0]).toMatchObject({
        delta: -60,
        reason: '크레딧 충전 취소 · ₩1,100',
        kind: 'refund',
      });

      // 두 번 와도 한 번만
      await request(server())
        .post('/api/billing/apple/notifications')
        .send({
          signedPayload: JSON.stringify({
            notificationType: 'REFUND',
            subtype: null,
            transaction: {
              transactionId: tx,
              productId: 'credits_100',
              environment: 'Sandbox',
              revoked: true,
            },
          }),
        })
        .expect(200);
      expect(
        (await request(server()).get('/api/wallet/ledger').set(as(u))).body
          .items[0].kind,
      ).toBe('refund');
    });

    it('Google RTDN: 인증이 틀리면 403, 환불 알림이면 회수', async () => {
      const u = await devLogin(app, '구글환불');
      const orderId = `GPA.r.${Date.now()}`;
      googlePlay.purchases.set('tok-r', {
        orderId,
        purchaseState: 0,
        consumptionState: 0,
      });
      await iap(u, {
        store: 'play',
        productId: 'credits_100',
        verificationData: 'tok-r',
      }).expect(200);
      const data = Buffer.from(
        JSON.stringify({
          voidedPurchaseNotification: { orderId, purchaseToken: 'tok-r' },
        }),
      ).toString('base64');
      await request(server())
        .post('/api/billing/google/rtdn')
        .set('Authorization', 'Bearer bad')
        .send({ message: { data } })
        .expect(403);
      await request(server())
        .post('/api/billing/google/rtdn')
        .set('Authorization', 'Bearer good')
        .send({ message: { data, messageId: '1' }, subscription: 's' })
        .expect(200);
      expect((await wallet(u)).credits).toBe(10);
    });
  });

  describe('AdMob SSV', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
    });
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

    beforeAll(() => {
      app.get(AdmobService).keySource = () =>
        Promise.resolve(new Map([['1234', pem]]));
    });

    const ssvQuery = (
      userId: string,
      transactionId: string,
      key = privateKey,
    ) => {
      const content = new URLSearchParams({
        ad_network: '5450213213286189855',
        ad_unit: '1234567890',
        reward_amount: '10',
        reward_item: 'credits',
        timestamp: String(Date.now()),
        transaction_id: transactionId,
        user_id: userId,
      }).toString();
      const signature = sign('sha256', Buffer.from(content), key).toString(
        'base64url',
      );
      return `${content}&signature=${signature}&key_id=1234`;
    };

    it('서명이 맞으면 10 크레딧, 같은 거래는 한 번, 하루 3회까지', async () => {
      const u = await devLogin(app, '광고');
      const before = await wallet(u);
      expect(before.ads).toEqual({
        rewardPerView: 10,
        dailyLimit: 3,
        remainingToday: 3,
      });

      const q1 = ssvQuery(u.user.id, `ad-${Date.now()}-1`);
      await request(server()).get(`/api/billing/admob/ssv?${q1}`).expect(200);
      await request(server()).get(`/api/billing/admob/ssv?${q1}`).expect(200); // 중복
      expect(await wallet(u)).toMatchObject({
        credits: 20,
        ads: { remainingToday: 2 },
      });

      for (let i = 2; i <= 4; i++) {
        await request(server())
          .get(
            `/api/billing/admob/ssv?${ssvQuery(u.user.id, `ad-${Date.now()}-${i}`)}`,
          )
          .expect(200);
      }
      expect(await wallet(u)).toMatchObject({
        credits: 40,
        ads: { remainingToday: 0 },
      });
      const ledger = await request(server())
        .get('/api/wallet/ledger')
        .set(as(u))
        .expect(200);
      expect(ledger.body.items[0]).toMatchObject({
        delta: 10,
        reason: '광고 보상',
        kind: 'ad_reward',
      });

      // 개발용 우회로도 같은 한도
      const dev = await request(server())
        .post('/api/dev/credits')
        .set(as(u))
        .send({ type: 'ad' })
        .expect(429);
      expect(dev.body.code).toBe('AD_LIMIT_REACHED');
    });

    it('서명이 틀리면 403 INVALID_SIGNATURE', async () => {
      const u = await devLogin(app, '광고사기');
      const other = generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
      }).privateKey;
      const forged = await request(server())
        .get(`/api/billing/admob/ssv?${ssvQuery(u.user.id, 'forged', other)}`)
        .expect(403);
      expect(forged.body.code).toBe('INVALID_SIGNATURE');
      // 서명 뒤에 값을 바꿔치기
      const q = ssvQuery(u.user.id, 'tamper').replace(
        'reward_amount=10',
        'reward_amount=99',
      );
      await request(server()).get(`/api/billing/admob/ssv?${q}`).expect(403);
      expect((await wallet(u)).credits).toBe(10);
    });
  });

  it('개발용 충전 우회로', async () => {
    const u = await devLogin(app, '개발충전');
    const res = await request(server())
      .post('/api/dev/credits')
      .set(as(u))
      .send({ type: 'charge', productId: 'credits_1200' })
      .expect(200);
    expect(res.body.credits).toBe(1210);
    const ledger = await request(server())
      .get('/api/wallet/ledger')
      .set(as(u))
      .expect(200);
    expect(ledger.body.items[0].reason).toBe('크레딧 충전 · ₩11,000');
  });
});
