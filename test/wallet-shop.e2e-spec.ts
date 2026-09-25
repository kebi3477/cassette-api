import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { AuthResponse } from '../src/auth/dto/auth.response.js';
import { bearer, befriend, createApp, devLogin, fcm, idem } from './utils.js';

describe('wallet · shop (e2e)', () => {
  let app: INestApplication<App>;
  const server = () => app.getHttpServer();
  const as = (u: AuthResponse) => bearer(u.accessToken);

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(() => app.close());

  const addCredits = (u: AuthResponse, amount: number) =>
    request(server())
      .post('/api/dev/credits')
      .set(as(u))
      .send({ type: 'admin', amount })
      .expect(200);
  const wallet = (u: AuthResponse) =>
    request(server())
      .get('/api/wallet')
      .set(as(u))
      .expect(200)
      .then((r) => r.body);

  it('GET /shop/products: 디자인 가격표와 스토어 상품 ID', async () => {
    const u = await devLogin(app, '상점');
    const res = await request(server())
      .get('/api/shop/products')
      .set(as(u))
      .expect(200);
    expect(
      res.body.tapes.map((p: { id: string; price: number }) => [p.id, p.price]),
    ).toEqual([
      ['tape3_1', 30],
      ['tape3_5', 120],
      ['tape5_1', 50],
      ['tape5_5', 200],
    ]);
    expect(res.body.drawer).toEqual([
      { id: 'drawer_10', name: '서랍 넓히기', slots: 10, price: 100 },
    ]);
    expect(
      res.body.creditPacks.map(
        (p: { productId: string; priceLabel: string }) => [
          p.productId,
          p.priceLabel,
        ],
      ),
    ).toEqual([
      ['credits_100', '₩1,100'],
      ['credits_550', '₩5,500'],
      ['credits_1200', '₩11,000'],
    ]);
    expect(res.body.giftAmounts).toEqual([10, 30, 50, 100]);
  });

  it('구매: 부족하면 402 need, 테이프·서랍 넓히기, 원장 문구', async () => {
    const u = await devLogin(app, '구매'); // 가입 선물 10
    const poor = await request(server())
      .post('/api/shop/purchases')
      .set(as(u))
      .set(idem())
      .send({ productId: 'tape3_1' })
      .expect(402);
    expect(poor.body).toMatchObject({ code: 'INSUFFICIENT_CREDITS', need: 20 });

    await addCredits(u, 310); // 320
    const tapes = await request(server())
      .post('/api/shop/purchases')
      .set(as(u))
      .set(idem())
      .send({ productId: 'tape3_5' })
      .expect(201);
    expect(tapes.body).toMatchObject({
      credits: 200,
      tapes: [
        { tapeType: 1, qty: null },
        { tapeType: 3, qty: 5 },
        { tapeType: 5, qty: 0 },
      ],
      entry: {
        delta: -120,
        reason: '3분 테이프 5개 구매',
        kind: 'tape_purchase',
      },
    });
    const drawer = await request(server())
      .post('/api/shop/purchases')
      .set(as(u))
      .set(idem())
      .send({ productId: 'drawer_10' })
      .expect(201);
    expect(drawer.body).toMatchObject({
      credits: 100,
      drawer: { cap: 22 },
      entry: { reason: '서랍 넓히기', delta: -100 },
    });
    await request(server())
      .post('/api/shop/purchases')
      .set(as(u))
      .set(idem())
      .send({ productId: 'nope' })
      .expect(404);

    const ledger = await request(server())
      .get('/api/wallet/ledger?limit=2')
      .set(as(u))
      .expect(200);
    expect(ledger.body.items.map((l: { reason: string }) => l.reason)).toEqual([
      '서랍 넓히기',
      '3분 테이프 5개 구매',
    ]);
    const next = await request(server())
      .get(`/api/wallet/ledger?limit=10&cursor=${ledger.body.nextCursor}`)
      .set(as(u))
      .expect(200);
    expect(next.body.items.map((l: { reason: string }) => l.reason)).toEqual([
      '개발용 지급',
      '가입 선물',
    ]);
    expect(next.body.nextCursor).toBeNull();
  });

  it('동시 구매: 잔액 100으로 30짜리를 5번 동시에 사면 3번만 된다', async () => {
    const u = await devLogin(app, '동시구매');
    await addCredits(u, 90); // 100
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(server())
          .post('/api/shop/purchases')
          .set(as(u))
          .set(idem())
          .send({ productId: 'tape3_1' }),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 402)).toHaveLength(2);
    const me = await request(server())
      .get('/api/users/me')
      .set(as(u))
      .expect(200);
    expect(me.body.credits).toBe(10);
    expect(me.body.tapes[1]).toEqual({ tapeType: 3, qty: 3 });
  });

  it('같은 Idempotency-Key로 다시 사면 한 번만 차감된다', async () => {
    const u = await devLogin(app, '재시도');
    await addCredits(u, 90);
    const key = idem();
    await request(server())
      .post('/api/shop/purchases')
      .set(as(u))
      .set(key)
      .send({ productId: 'tape3_1' })
      .expect(201);
    const again = await request(server())
      .post('/api/shop/purchases')
      .set(as(u))
      .set(key)
      .send({ productId: 'tape3_1' })
      .expect(201);
    expect(again.headers['idempotent-replayed']).toBe('true');
    expect((await wallet(u)).credits).toBe(70);
  });

  describe('선물', () => {
    let a: AuthResponse;
    let b: AuthResponse;

    beforeAll(async () => {
      a = await devLogin(app, '지현');
      b = await devLogin(app, '민경');
      await befriend(app, a, b);
      await request(server())
        .put('/api/notifications/devices')
        .set(as(b))
        .send({ token: 'fcm-token-b-000000001', platform: 'ios' })
        .expect(204);
    });

    it('10/30/50/100만, 친구에게만', async () => {
      const bad = await request(server())
        .post('/api/wallet/gifts')
        .set(as(a))
        .set(idem())
        .send({ toUserId: b.user.id, amount: 20 })
        .expect(400);
      expect(bad.body.code).toBe('INVALID_GIFT_AMOUNT');
      const stranger = await devLogin(app, '모름');
      const nf = await request(server())
        .post('/api/wallet/gifts')
        .set(as(a))
        .set(idem())
        .send({ toUserId: stranger.user.id, amount: 10 })
        .expect(404);
      expect(nf.body.code).toBe('FRIEND_NOT_FOUND');
    });

    it('원장 두 줄 + 받은 사람에게 푸시', async () => {
      await addCredits(a, 90); // 100
      fcm.sent = [];
      const res = await request(server())
        .post('/api/wallet/gifts')
        .set(as(a))
        .set(idem())
        .send({ toUserId: b.user.id, amount: 30 })
        .expect(201);
      expect(res.body).toMatchObject({
        credits: 70,
        entry: { delta: -30, reason: '민경님에게 선물', kind: 'gift_sent' },
      });
      const bl = await request(server())
        .get('/api/wallet/ledger')
        .set(as(b))
        .expect(200);
      expect(bl.body.items[0]).toMatchObject({
        delta: 30,
        reason: '지현님이 선물',
        kind: 'gift_received',
      });
      expect((await wallet(b)).credits).toBe(40);
      await vi.waitFor(() =>
        expect(fcm.sent).toContainEqual({
          token: 'fcm-token-b-000000001',
          title: '지현님이 크레딧을 선물했어요',
          body: '30 크레딧을 받았어요',
          data: { type: 'gift' },
        }),
      );
    });

    it('동시 선물: 잔액 70으로 30씩 5번 → 2번만, 서로 동시에 주고받아도 교착 없음', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(server())
            .post('/api/wallet/gifts')
            .set(as(a))
            .set(idem())
            .send({ toUserId: b.user.id, amount: 30 }),
        ),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(2);
      expect(
        results
          .filter((r) => r.status === 402)
          .every((r) => r.body.code === 'INSUFFICIENT_CREDITS'),
      ).toBe(true);
      expect((await wallet(a)).credits).toBe(10);
      expect((await wallet(b)).credits).toBe(100);

      await addCredits(a, 90); // a 100, b 100
      const both = await Promise.all([
        ...Array.from({ length: 3 }, () =>
          request(server())
            .post('/api/wallet/gifts')
            .set(as(a))
            .set(idem())
            .send({ toUserId: b.user.id, amount: 10 }),
        ),
        ...Array.from({ length: 3 }, () =>
          request(server())
            .post('/api/wallet/gifts')
            .set(as(b))
            .set(idem())
            .send({ toUserId: a.user.id, amount: 10 }),
        ),
      ]);
      expect(both.every((r) => r.status === 201)).toBe(true);
      expect((await wallet(a)).credits + (await wallet(b)).credits).toBe(200);
    });

    it('알림을 끄면 푸시하지 않고, 차단 관계면 선물할 수 없다', async () => {
      await request(server())
        .patch('/api/users/me')
        .set(as(b))
        .send({ notificationsEnabled: false })
        .expect(200);
      fcm.sent = [];
      await addCredits(a, 10);
      await request(server())
        .post('/api/wallet/gifts')
        .set(as(a))
        .set(idem())
        .send({ toUserId: b.user.id, amount: 10 })
        .expect(201);
      await new Promise((r) => setTimeout(r, 100));
      expect(fcm.sent).toEqual([]);

      await request(server())
        .post(`/api/friends/${a.user.id}/block`)
        .set(as(b))
        .expect(200);
      const blocked = await request(server())
        .post('/api/wallet/gifts')
        .set(as(a))
        .set(idem())
        .send({ toUserId: b.user.id, amount: 10 })
        .expect(403);
      expect(blocked.body.code).toBe('GIFT_NOT_ALLOWED');
    });
  });
});
