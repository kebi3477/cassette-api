import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { AuthResponse } from '../src/auth/dto/auth.response.js';
import { bearer, createApp, devLogin } from './utils.js';

describe('개발 로그인 → 내 정보 → 이름 수정 → 친구 즐겨찾기/차단 (e2e)', () => {
  let app: INestApplication<App>;
  let me: AuthResponse;
  let auth: { Authorization: string };
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    app = await createApp();
    me = await devLogin(app, '민경');
    auth = bearer(me.accessToken);
  });
  afterAll(() => app.close());

  const addFriend = async (name: string, starred = false) => {
    const res = await request(server())
      .post('/api/dev/friends')
      .set(auth)
      .send({ name, starred })
      .expect(201);
    return res.body as { userId: string; name: string };
  };

  it('GET /users/me', async () => {
    const res = await request(server())
      .get('/api/users/me')
      .set(auth)
      .expect(200);
    expect(res.body).toMatchObject({
      id: me.user.id,
      name: '민경',
      credits: 10,
      drawer: { stored: 0, cap: 12, full: false },
      tapes: [
        { tapeType: 1, qty: null },
        { tapeType: 3, qty: 0 },
        { tapeType: 5, qty: 0 },
      ],
      stats: { receivedCount: 0, sentCount: 0, friendCount: 0 },
      notificationsEnabled: true,
    });
  });

  it('PATCH /users/me: 이름과 알림 설정을 바꾼다', async () => {
    const res = await request(server())
      .patch('/api/users/me')
      .set(auth)
      .send({ name: '  새이름 ', notificationsEnabled: false })
      .expect(200);
    expect(res.body).toMatchObject({
      name: '새이름',
      notificationsEnabled: false,
    });
  });

  it('PATCH /users/me: 8자를 넘으면 INVALID_NAME', async () => {
    const res = await request(server())
      .patch('/api/users/me')
      .set(auth)
      .send({ name: '가나다라마바사아자' })
      .expect(400);
    expect(res.body).toEqual({
      code: 'INVALID_NAME',
      message: '이름은 1~8자로 적어주세요',
    });
  });

  it('PATCH /users/me: 모르는 필드는 VALIDATION_FAILED', async () => {
    const res = await request(server())
      .patch('/api/users/me')
      .set(auth)
      .send({ credits: 9999 })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('친구 목록: 즐겨찾기 먼저, 그다음 최근 순', async () => {
    const minsu = await addFriend('민수');
    const jihyun = await addFriend('지현', true);
    const haneul = await addFriend('하늘');

    const res = await request(server())
      .get('/api/friends')
      .set(auth)
      .expect(200);
    expect(res.body.items.map((f: { name: string }) => f.name)).toEqual([
      '지현',
      '하늘',
      '민수',
    ]);
    expect(res.body.items[0]).toMatchObject({
      userId: jihyun.userId,
      starred: true,
    });
    expect(res.body.items[0].lastAt).toMatch(/Z$/);

    const meRes = await request(server())
      .get('/api/users/me')
      .set(auth)
      .expect(200);
    expect(meRes.body.stats.friendCount).toBe(3);

    // 즐겨찾기 켜기 → 즐겨찾기 묶음(최근 순)으로 올라간다
    const star = await request(server())
      .patch(`/api/friends/${minsu.userId}`)
      .set(auth)
      .send({ starred: true })
      .expect(200);
    expect(star.body).toMatchObject({ name: '민수', starred: true });
    const after = await request(server())
      .get('/api/friends')
      .set(auth)
      .expect(200);
    expect(after.body.items.map((f: { name: string }) => f.name)).toEqual([
      '지현',
      '민수',
      '하늘',
    ]);

    // 목록에서 빼기
    await request(server())
      .delete(`/api/friends/${haneul.userId}`)
      .set(auth)
      .expect(204);
    await request(server())
      .delete(`/api/friends/${haneul.userId}`)
      .set(auth)
      .expect(404);
  });

  it('차단 → 차단 목록 → 해제하면 즐겨찾기까지 되돌아온다', async () => {
    const eunbi = await addFriend('은비', true);

    const blocked = await request(server())
      .post(`/api/friends/${eunbi.userId}/block`)
      .set(auth)
      .expect(200);
    expect(blocked.body).toMatchObject({ userId: eunbi.userId, name: '은비' });

    const list = await request(server())
      .get('/api/friends')
      .set(auth)
      .expect(200);
    expect(
      list.body.items.find(
        (f: { userId: string }) => f.userId === eunbi.userId,
      ),
    ).toBeUndefined();

    const blocks = await request(server())
      .get('/api/friends/blocks')
      .set(auth)
      .expect(200);
    expect(blocks.body.items).toEqual([
      {
        userId: eunbi.userId,
        name: '은비',
        nickname: null,
        blockedAt: expect.stringMatching(/Z$/),
      },
    ]);

    // 두 번 차단해도 그대로
    await request(server())
      .post(`/api/friends/${eunbi.userId}/block`)
      .set(auth)
      .expect(200);

    await request(server())
      .delete(`/api/friends/${eunbi.userId}/block`)
      .set(auth)
      .expect(204);
    const restored = await request(server())
      .get('/api/friends')
      .set(auth)
      .expect(200);
    expect(
      restored.body.items.find(
        (f: { userId: string }) => f.userId === eunbi.userId,
      ),
    ).toMatchObject({
      name: '은비',
      starred: true,
    });
    const empty = await request(server())
      .get('/api/friends/blocks')
      .set(auth)
      .expect(200);
    expect(empty.body.items).toEqual([]);

    const again = await request(server())
      .delete(`/api/friends/${eunbi.userId}/block`)
      .set(auth)
      .expect(404);
    expect(again.body.code).toBe('BLOCK_NOT_FOUND');
  });

  it('차단 오류: 나 자신, 없는 사용자, 잘못된 id', async () => {
    const self = await request(server())
      .post(`/api/friends/${me.user.id}/block`)
      .set(auth)
      .expect(400);
    expect(self.body.code).toBe('CANNOT_BLOCK_SELF');

    const missing = await request(server())
      .post('/api/friends/00000000-0000-4000-8000-000000000000/block')
      .set(auth)
      .expect(404);
    expect(missing.body.code).toBe('USER_NOT_FOUND');

    const bad = await request(server())
      .post('/api/friends/abc/block')
      .set(auth)
      .expect(400);
    expect(bad.body.code).toBe('VALIDATION_FAILED');
  });

  it('친구가 아닌 사람 즐겨찾기는 FRIEND_NOT_FOUND', async () => {
    const other = await devLogin(app, '남');
    const res = await request(server())
      .patch(`/api/friends/${other.user.id}`)
      .set(auth)
      .send({ starred: true })
      .expect(404);
    expect(res.body.code).toBe('FRIEND_NOT_FOUND');
  });

  it('회원 탈퇴: 데이터가 지워지고 토큰도 더 못 쓴다. 상대 친구 목록에서도 빠진다', async () => {
    const leaver = await devLogin(app, '떠날사람');
    const leaverAuth = bearer(leaver.accessToken);
    await request(server())
      .post('/api/dev/friends')
      .set(leaverAuth)
      .send({ userId: me.user.id })
      .expect(201);
    const before = await request(server())
      .get('/api/friends')
      .set(auth)
      .expect(200);
    expect(
      before.body.items.some(
        (f: { userId: string }) => f.userId === leaver.user.id,
      ),
    ).toBe(true);

    await request(server()).delete('/api/users/me').set(leaverAuth).expect(204);

    await request(server()).get('/api/users/me').set(leaverAuth).expect(401);
    await request(server())
      .post('/api/auth/refresh')
      .send({ refreshToken: leaver.refreshToken })
      .expect(401);
    const after = await request(server())
      .get('/api/friends')
      .set(auth)
      .expect(200);
    expect(
      after.body.items.some(
        (f: { userId: string }) => f.userId === leaver.user.id,
      ),
    ).toBe(false);
  });
});
