import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { AuthResponse } from '../src/auth/dto/auth.response.js';
import {
  bearer,
  befriend,
  createApp,
  devLogin,
  fcm,
  idem,
  readyRecording,
} from './utils.js';

describe('친구 별명 (e2e)', () => {
  let app: INestApplication<App>;
  const server = () => app.getHttpServer();
  const as = (u: AuthResponse) => bearer(u.accessToken);
  let me: AuthResponse;
  let dongmin: AuthResponse;

  beforeAll(async () => {
    app = await createApp();
    me = await devLogin(app, '민경');
    dongmin = await devLogin(app, '고동민');
    await befriend(app, me, dongmin);
  });
  afterAll(() => app.close());

  const setNick = (nickname: unknown, u = me, target = dongmin) =>
    request(server())
      .patch(`/api/friends/${target.user.id}`)
      .set(as(u))
      .send({ nickname });

  it('설정 · 지우기 · 규칙 (10자, 한글·이모지 한 글자), starred와 함께', async () => {
    const set = await setNick('  남편 💛 ').expect(200);
    expect(set.body).toMatchObject({
      userId: dongmin.user.id,
      name: '고동민',
      nickname: '남편 💛',
      starred: false,
    });

    const both = await request(server())
      .patch(`/api/friends/${dongmin.user.id}`)
      .set(as(me))
      .send({ nickname: '동민이', starred: true })
      .expect(200);
    expect(both.body).toMatchObject({ nickname: '동민이', starred: true });

    await setNick('가나다라마바사아자차').expect(200); // 10자
    const tooLong = await setNick('가나다라마바사아자차카').expect(400);
    expect(tooLong.body).toEqual({
      code: 'INVALID_NICKNAME',
      message: '별명은 10자까지 적을 수 있어요',
    });
    await setNick('줄\n바꿈').expect(400);
    const notString = await setNick(123).expect(400);
    expect(notString.body.code).toBe('VALIDATION_FAILED');

    expect((await setNick('').expect(200)).body.nickname).toBeNull();
    await setNick('동민이').expect(200);
    expect((await setNick(null).expect(200)).body.nickname).toBeNull();

    // 아무것도 안 보내면 400
    await request(server())
      .patch(`/api/friends/${dongmin.user.id}`)
      .set(as(me))
      .send({})
      .expect(400);
  });

  it('내가 보는 모든 곳에 별명이 나오고, 상대에게는 보이지 않는다', async () => {
    await setNick('동민이').expect(200);
    const nick = { name: '고동민', nickname: '동민이' };

    // 친구 목록
    const friends = await request(server())
      .get('/api/friends')
      .set(as(me))
      .expect(200);
    expect(friends.body.items[0]).toMatchObject({
      userId: dongmin.user.id,
      ...nick,
    });

    // 받은 테이프 (서랍, 받은 테이프 하나, 뜯기, 친구 화면)
    const rec = await readyRecording(app, dongmin.accessToken);
    const sent = await request(server())
      .post('/api/deliveries')
      .set(as(dongmin))
      .set(idem())
      .send({ recordingId: rec, recipientId: me.user.id })
      .expect(201);
    const shelf = await request(server())
      .get('/api/shelf')
      .set(as(me))
      .expect(200);
    expect(shelf.body.unsorted[0].sender).toEqual({
      userId: dongmin.user.id,
      ...nick,
    });
    const one = await request(server())
      .get(`/api/deliveries/${sent.body.id}`)
      .set(as(me))
      .expect(200);
    expect(one.body.sender.nickname).toBe('동민이');
    const opened = await request(server())
      .post(`/api/deliveries/${sent.body.id}/open`)
      .set(as(me))
      .expect(200);
    expect(opened.body.sender.nickname).toBe('동민이');
    const tapes = await request(server())
      .get(`/api/friends/${dongmin.user.id}/tapes`)
      .set(as(me))
      .expect(200);
    expect(tapes.body.friend).toMatchObject(nick);
    expect(tapes.body.items[0].sender).toMatchObject(nick);

    // 보낸 테이프 (받는 사람)
    const myRec = await readyRecording(app, me.accessToken);
    const mine = await request(server())
      .post('/api/deliveries')
      .set(as(me))
      .set(idem())
      .send({ recordingId: myRec, recipientId: dongmin.user.id })
      .expect(201);
    expect(mine.body.recipient).toEqual({ userId: dongmin.user.id, ...nick });
    const sentList = await request(server())
      .get('/api/deliveries/sent')
      .set(as(me))
      .expect(200);
    expect(sentList.body.items[0].recipient).toMatchObject(nick);

    // 상대에게는 보이지 않는다: 동민이 보는 나는 별명 없음, 동민이 받은 내 테이프의 보낸 사람도 별명 없음
    const theirFriends = await request(server())
      .get('/api/friends')
      .set(as(dongmin))
      .expect(200);
    expect(theirFriends.body.items[0]).toMatchObject({
      userId: me.user.id,
      name: '민경',
      nickname: null,
    });
    const theirShelf = await request(server())
      .get('/api/shelf')
      .set(as(dongmin))
      .expect(200);
    expect(theirShelf.body.unsorted[0].sender).toEqual({
      userId: me.user.id,
      name: '민경',
      nickname: null,
    });
    const theirSent = await request(server())
      .get(`/api/deliveries/sent/${sent.body.id}`)
      .set(as(dongmin))
      .expect(200);
    expect(theirSent.body.recipient).toEqual({
      userId: me.user.id,
      name: '민경',
      nickname: null,
    });
  });

  it('링크 열기: 보낸 사람이 이미 내 친구면 별명, 받으면 친구 응답에도 별명', async () => {
    await setNick('동민이').expect(200);
    const rec = await readyRecording(app, dongmin.accessToken);
    const link = await request(server())
      .post('/api/deliveries')
      .set(as(dongmin))
      .set(idem())
      .send({ recordingId: rec, linkName: '민경' })
      .expect(201);
    const token = (link.body.share.url as string).split('/t/')[1];
    const preview = await request(server())
      .get(`/api/share/${token}`)
      .set(as(me))
      .expect(200);
    expect(preview.body.sender).toEqual({
      userId: dongmin.user.id,
      name: '고동민',
      nickname: '동민이',
    });
    const claimed = await request(server())
      .post(`/api/share/${token}/claim`)
      .set(as(me))
      .set(idem())
      .expect(200);
    expect(claimed.body.item.sender.nickname).toBe('동민이');
    expect(claimed.body.friend).toMatchObject({ nickname: '동민이' });

    // 친구가 아닌 사람의 링크는 별명 없음
    const stranger = await devLogin(app, '모르는');
    const rec2 = await readyRecording(app, stranger.accessToken);
    const link2 = await request(server())
      .post('/api/deliveries')
      .set(as(stranger))
      .set(idem())
      .send({ recordingId: rec2, linkName: '민경' })
      .expect(201);
    const token2 = (link2.body.share.url as string).split('/t/')[1];
    const p2 = await request(server())
      .get(`/api/share/${token2}`)
      .set(as(me))
      .expect(200);
    expect(p2.body.sender).toEqual({
      userId: stranger.user.id,
      name: '모르는',
      nickname: null,
    });
  });

  it('푸시는 받는 사람이 붙인 별명으로 (테이프, 선물, 링크 받음)', async () => {
    await setNick('동민이').expect(200);
    await request(server())
      .put('/api/notifications/devices')
      .set(as(me))
      .send({ token: 'fcm-me-nick-0000001', platform: 'ios' })
      .expect(204);
    await request(server())
      .put('/api/notifications/devices')
      .set(as(dongmin))
      .send({ token: 'fcm-dm-nick-0000001', platform: 'android' })
      .expect(204);
    // 동민이 나에게 붙인 별명
    await setNick('여보', dongmin, me).expect(200);
    fcm.sent = [];

    const rec = await readyRecording(app, dongmin.accessToken);
    await request(server())
      .post('/api/deliveries')
      .set(as(dongmin))
      .set(idem())
      .send({ recordingId: rec, recipientId: me.user.id })
      .expect(201);
    await vi.waitFor(() =>
      expect(fcm.sent).toContainEqual(
        expect.objectContaining({
          token: 'fcm-me-nick-0000001',
          title: '동민이님이 테이프를 보냈어요',
        }),
      ),
    );

    await request(server())
      .post('/api/dev/credits')
      .set(as(dongmin))
      .send({ type: 'admin', amount: 100 })
      .expect(200);
    await request(server())
      .post('/api/wallet/gifts')
      .set(as(dongmin))
      .set(idem())
      .send({ toUserId: me.user.id, amount: 10 })
      .expect(201);
    await vi.waitFor(() =>
      expect(fcm.sent).toContainEqual(
        expect.objectContaining({
          token: 'fcm-me-nick-0000001',
          title: '동민이님이 크레딧을 선물했어요',
        }),
      ),
    );
    // 크레딧 내역 문구는 원래 이름으로 기록한다
    const ledger = await request(server())
      .get('/api/wallet/ledger')
      .set(as(me))
      .expect(200);
    expect(ledger.body.items[0].reason).toBe('고동민님이 선물');

    // 링크를 받으면 보낸 사람(동민)이 붙인 별명으로
    const rec2 = await readyRecording(app, dongmin.accessToken);
    const link = await request(server())
      .post('/api/deliveries')
      .set(as(dongmin))
      .set(idem())
      .send({ recordingId: rec2, linkName: '민경' })
      .expect(201);
    const token = (link.body.share.url as string).split('/t/')[1];
    await request(server())
      .post(`/api/share/${token}/claim`)
      .set(as(me))
      .set(idem())
      .expect(200);
    await vi.waitFor(() =>
      expect(fcm.sent).toContainEqual(
        expect.objectContaining({
          token: 'fcm-dm-nick-0000001',
          title: '여보님이 테이프를 받았어요',
        }),
      ),
    );
  });

  it('차단 목록에 별명, 해제하면 즐겨찾기와 별명이 되돌아온다. 목록에서 빼면 별명도 사라진다', async () => {
    await request(server())
      .patch(`/api/friends/${dongmin.user.id}`)
      .set(as(me))
      .send({ nickname: '동민이', starred: true })
      .expect(200);
    const blocked = await request(server())
      .post(`/api/friends/${dongmin.user.id}/block`)
      .set(as(me))
      .expect(200);
    expect(blocked.body).toMatchObject({ name: '고동민', nickname: '동민이' });
    const list = await request(server())
      .get('/api/friends/blocks')
      .set(as(me))
      .expect(200);
    expect(list.body.items[0]).toMatchObject({
      userId: dongmin.user.id,
      name: '고동민',
      nickname: '동민이',
    });

    await request(server())
      .delete(`/api/friends/${dongmin.user.id}/block`)
      .set(as(me))
      .expect(204);
    const restored = await request(server())
      .get('/api/friends')
      .set(as(me))
      .expect(200);
    expect(
      restored.body.items.find(
        (f: { userId: string }) => f.userId === dongmin.user.id,
      ),
    ).toMatchObject({
      nickname: '동민이',
      starred: true,
    });

    await request(server())
      .delete(`/api/friends/${dongmin.user.id}`)
      .set(as(me))
      .expect(204);
    await befriend(app, me, dongmin);
    const again = await request(server())
      .get('/api/friends')
      .set(as(me))
      .expect(200);
    expect(
      again.body.items.find(
        (f: { userId: string }) => f.userId === dongmin.user.id,
      ).nickname,
    ).toBeNull();
  });
});
