import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import type { AuthResponse } from '../src/auth/dto/auth.response.js';
import { ReportsService } from '../src/reports/reports.service.js';
import {
  bearer,
  befriend,
  clock,
  createApp,
  devLogin,
  idem,
  readyRecording,
} from './utils.js';

const DAY = 86_400_000;

describe('신고 POST /reports (e2e)', () => {
  let app: INestApplication<App>;
  let ds: DataSource;
  const server = () => app.getHttpServer();
  const as = (u: AuthResponse) => bearer(u.accessToken);
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  const realFetch = globalThis.fetch;

  beforeAll(async () => {
    app = await createApp();
    ds = app.get<DataSource>(getDataSourceToken());
  });
  afterAll(() => app.close());
  beforeEach(() => {
    // 웹훅만 가로채고 나머지는 그대로
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) =>
        String(input).startsWith('https://hooks.test/')
          ? Promise.resolve(new Response('ok'))
          : realFetch(input, init),
      );
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    clock.offsetMs = 0;
  });

  const report = (u: AuthResponse, body: Record<string, unknown>) =>
    request(server()).post('/api/reports').set(as(u)).set(idem()).send(body);
  const webhookCalls = () =>
    fetchSpy.mock.calls.filter(([u]) =>
      String(u).startsWith('https://hooks.test/'),
    );

  /** a가 b에게 테이프를 보낸다 */
  const sendTape = async (a: AuthResponse, b: AuthResponse) => {
    const rec = await readyRecording(app, a.accessToken);
    const sent = await request(server())
      .post('/api/deliveries')
      .set(as(a))
      .set(idem())
      .send({ recordingId: rec, recipientId: b.user.id })
      .expect(201);
    return sent.body.id as string;
  };

  it('받은 테이프 신고 → 201, 테이프 보낸 사람 기록, 로그·웹훅(개인정보 없음)', async () => {
    const sender = await devLogin(app, '보냄');
    const me = await devLogin(app, '신고자');
    await befriend(app, sender, me);
    const tapeId = await sendTape(sender, me);

    const res = await report(me, {
      target: { type: 'tape', deliveryId: tapeId },
      reason: 'harassment',
      memo: '  계속 욕을 해요  ',
    }).expect(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      createdAt: expect.stringMatching(/Z$/),
    });

    const [row] = await ds.query('SELECT * FROM reports WHERE id = $1', [
      res.body.id,
    ]);
    expect(row).toMatchObject({
      reporter_id: me.user.id,
      target_type: 'tape',
      target_id: tapeId,
      tape_sender_id: sender.user.id,
      reason: 'harassment',
      memo: '계속 욕을 해요',
      status: 'received',
    });

    await vi.waitFor(() => expect(webhookCalls()).toHaveLength(1));
    const body = JSON.parse(String(webhookCalls()[0][1]!.body)) as Record<
      string,
      unknown
    >;
    expect(body.report).toEqual({
      id: res.body.id,
      reason: 'harassment',
      targetType: 'tape',
      createdAt: res.body.createdAt,
    });
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('계속 욕을 해요');
    expect(raw).not.toContain(me.user.id);
    expect(raw).not.toContain(sender.user.id);
  });

  it('24시간 안에 같은 대상을 다시 신고하면 기존 신고를 돌려주고, 24시간 뒤에는 새로 만든다', async () => {
    const sender = await devLogin(app, '보냄2');
    const me = await devLogin(app, '신고자2');
    await befriend(app, sender, me);

    const first = await report(me, {
      target: { type: 'user', userId: sender.user.id },
      reason: 'spam',
    }).expect(201);
    const again = await report(me, {
      target: { type: 'user', userId: sender.user.id },
      reason: 'other',
    }).expect(201);
    expect(again.body).toEqual(first.body);
    await vi.waitFor(() => expect(webhookCalls()).toHaveLength(1));

    clock.offsetMs = DAY + 60_000;
    const later = await report(me, {
      target: { type: 'user', userId: sender.user.id },
      reason: 'spam',
    }).expect(201);
    expect(later.body.id).not.toBe(first.body.id);
  });

  it('alsoBlock: 같은 트랜잭션에서 차단 (테이프면 보낸 사람)', async () => {
    const sender = await devLogin(app, '보냄3');
    const me = await devLogin(app, '신고자3');
    await befriend(app, sender, me);
    const tapeId = await sendTape(sender, me);

    await report(me, {
      target: { type: 'tape', deliveryId: tapeId },
      reason: 'sexual',
      alsoBlock: true,
    }).expect(201);
    const blocks = await request(server())
      .get('/api/friends/blocks')
      .set(as(me))
      .expect(200);
    expect(blocks.body.items.map((b: { userId: string }) => b.userId)).toEqual([
      sender.user.id,
    ]);
    const friends = await request(server())
      .get('/api/friends')
      .set(as(me))
      .expect(200);
    expect(friends.body.items).toEqual([]);

    // 차단한 뒤에도 그 사람을 신고할 수 있다 (테이프를 보낸 적이 있으므로)
    await report(me, {
      target: { type: 'user', userId: sender.user.id },
      reason: 'harassment',
      alsoBlock: true,
    }).expect(201);
  });

  it('권한 없는 대상은 404, 나 자신은 400, 잘못된 입력은 400', async () => {
    const me = await devLogin(app, '신고자4');
    const stranger = await devLogin(app, '모름');
    const other = await devLogin(app, '다른');
    await befriend(app, other, stranger);
    const othersTape = await sendTape(other, stranger);

    const notMine = await report(me, {
      target: { type: 'tape', deliveryId: othersTape },
      reason: 'spam',
    }).expect(404);
    expect(notMine.body.code).toBe('REPORT_TARGET_NOT_FOUND');
    const unrelated = await report(me, {
      target: { type: 'user', userId: stranger.user.id },
      reason: 'spam',
    }).expect(404);
    expect(unrelated.body.code).toBe('REPORT_TARGET_NOT_FOUND');
    await report(me, {
      target: { type: 'user', userId: '00000000-0000-4000-8000-000000000000' },
      reason: 'spam',
    }).expect(404);

    const self = await report(me, {
      target: { type: 'user', userId: me.user.id },
      reason: 'spam',
    }).expect(400);
    expect(self.body.code).toBe('CANNOT_REPORT_SELF');

    for (const bad of [
      { target: { type: 'tape' }, reason: 'spam' },
      { target: { type: 'user', userId: stranger.user.id }, reason: 'rude' },
      {
        target: { type: 'user', userId: stranger.user.id },
        reason: 'spam',
        memo: '가'.repeat(301),
      },
      {
        target: { type: 'user', userId: stranger.user.id, extra: 1 },
        reason: 'spam',
      },
    ]) {
      const r = await report(me, bad).expect(400);
      expect(r.body.code).toBe('VALIDATION_FAILED');
    }
    await request(server())
      .post('/api/reports')
      .set(as(me))
      .send({
        target: { type: 'user', userId: stranger.user.id },
        reason: 'spam',
      })
      .expect(400);
  });

  it('하루 20건 한도, 넘으면 429 RATE_LIMITED', async () => {
    const me = await devLogin(app, '많이');
    const targets: AuthResponse[] = [];
    for (let i = 0; i < 21; i++) {
      const t = await devLogin(app, `대상${i}`);
      await befriend(app, me, t);
      targets.push(t);
    }
    for (let i = 0; i < 20; i++) {
      await report(me, {
        target: { type: 'user', userId: targets[i].user.id },
        reason: 'spam',
      }).expect(201);
    }
    const over = await report(me, {
      target: { type: 'user', userId: targets[20].user.id },
      reason: 'spam',
    }).expect(429);
    expect(over.body.code).toBe('RATE_LIMITED');
    // 중복 신고는 한도와 상관없이 기존 신고를 돌려준다
    await report(me, {
      target: { type: 'user', userId: targets[0].user.id },
      reason: 'spam',
    }).expect(201);
  });

  it('신고자가 탈퇴하면 신고자만 NULL, 기록은 남고 3년 뒤 정리 작업이 지운다', async () => {
    const sender = await devLogin(app, '보냄5');
    const me = await devLogin(app, '떠날신고자');
    await befriend(app, sender, me);
    const res = await report(me, {
      target: { type: 'user', userId: sender.user.id },
      reason: 'impersonation',
    }).expect(201);

    await request(server()).delete('/api/users/me').set(as(me)).expect(204);
    const [row] = await ds.query(
      'SELECT reporter_id, target_id FROM reports WHERE id = $1',
      [res.body.id],
    );
    expect(row).toEqual({ reporter_id: null, target_id: sender.user.id });

    const reports = app.get(ReportsService);
    clock.offsetMs = 3 * 365 * DAY - DAY; // 3년이 안 됨
    await reports.purgeExpired();
    expect(
      (await ds.query('SELECT 1 FROM reports WHERE id = $1', [res.body.id]))
        .length,
    ).toBe(1);

    clock.offsetMs = 3 * 366 * DAY + DAY;
    expect(await reports.purgeExpired()).toBeGreaterThanOrEqual(1);
    expect(
      (await ds.query('SELECT 1 FROM reports WHERE id = $1', [res.body.id]))
        .length,
    ).toBe(0);
  });

  it('웹훅이 실패해도 신고는 성공한다', async () => {
    fetchSpy.mockImplementation((input, init) =>
      String(input).startsWith('https://hooks.test/')
        ? Promise.reject(new Error('down'))
        : realFetch(input, init),
    );
    const sender = await devLogin(app, '보냄6');
    const me = await devLogin(app, '신고자6');
    await befriend(app, sender, me);
    await report(me, {
      target: { type: 'user', userId: sender.user.id },
      reason: 'illegal',
    }).expect(201);
  });
});
