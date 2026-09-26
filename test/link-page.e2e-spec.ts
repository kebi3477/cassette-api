import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { bearer, createApp, devLogin, idem, readyRecording } from './utils.js';

describe('링크 웹 페이지 /t/{token} (e2e)', () => {
  let app: INestApplication<App>;
  let ds: DataSource;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    app = await createApp();
    ds = app.get<DataSource>(getDataSourceToken());
  });
  afterAll(() => app.close());

  const makeLink = async (name: string) => {
    const a = await devLogin(app, name);
    await ds.query(
      `INSERT INTO tape_inventory (user_id, tape_type, qty) VALUES ($1, 60, 1)`,
      [a.user.id],
    );
    const rec = await readyRecording(app, a.accessToken, 60);
    const sent = await request(server())
      .post('/api/deliveries')
      .set(bearer(a.accessToken))
      .set(idem())
      .send({ recordingId: rec, linkName: '받을분' })
      .expect(201);
    return {
      a,
      id: sent.body.id as string,
      token: (sent.body.share.url as string).split('/t/')[1],
    };
  };

  const nonceOf = (csp: string) => /script-src 'nonce-([^']+)'/.exec(csp)?.[1];

  it('받을 수 있는 링크: 200, 이름 이스케이프, OG 태그, CSP nonce', async () => {
    const { token } = await makeLink(`<b>&'"`);
    const res = await request(server()).get(`/t/${token}`).expect(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['cache-control']).toBe('no-store');

    // 이스케이프: 원문 태그가 그대로 들어가지 않는다
    expect(res.text).not.toContain(`<b>&'"님`);
    expect(res.text).toContain(
      '&lt;b&gt;&amp;&#39;&quot;님이<br>테이프를 보냈어요',
    );

    // OG (카카오톡·문자 미리보기)
    expect(res.text).toContain(
      '<meta property="og:title" content="&lt;b&gt;&amp;&#39;&quot;님이 테이프를 보냈어요">',
    );
    expect(res.text).toContain(
      '<meta property="og:image" content="https://tapeletter.test/static/og-image.png">',
    );
    expect(res.text).toContain(
      `<meta property="og:url" content="https://tapeletter.test/t/${token}">`,
    );
    expect(res.text).toContain(
      '1분 테이프 · 앱이 없어도 이 페이지에서 7일 동안 들을 수 있어요',
    );

    // CSP: 요청마다 nonce, 인라인 스크립트·스타일은 그 nonce로만
    const csp = res.headers['content-security-policy'] as string;
    const nonce = nonceOf(csp);
    expect(nonce).toBeTruthy();
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain(
      `style-src 'nonce-${nonce}' https://cdn.jsdelivr.net`,
    );
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(res.text).toContain(`<script nonce="${nonce}">`);
    expect(res.text).toContain(`<style nonce="${nonce}">`);
    const scripts =
      res.text.match(/<script(?![^>]*type="application\/json")[^>]*>/g) ?? [];
    expect(scripts.every((s) => s.includes(`nonce="${nonce}"`))).toBe(true);
    expect(res.text).not.toMatch(/ style="/);
    expect(res.text).not.toMatch(/ on[a-z]+="/);

    const again = await request(server()).get(`/t/${token}`).expect(200);
    expect(
      nonceOf(again.headers['content-security-policy'] as string),
    ).not.toBe(nonce);

    // 스토어·앱에서 열기
    expect(res.text).toContain('href="https://apps.apple.com/app/id1"');
    expect(res.text).toContain(`"appUrl":"tapeletter://t/${token}"`);
    expect(res.text).toContain('<span>tapeletter</span>');
    expect(res.text).toContain(
      '<meta property="og:site_name" content="tapeletter">',
    );
    expect(res.text).not.toContain('cassette');
  });

  it('남은 기간은 expiresAt으로 계산한다', async () => {
    const { id, token } = await makeLink('기한');
    await ds.query(
      `UPDATE deliveries SET share_expires_at = now() + interval '2 days 3 hours' WHERE id = $1`,
      [id],
    );
    const res = await request(server()).get(`/t/${token}`).expect(200);
    expect(res.text).toContain(
      '앱이 없어도 이 페이지에서 3일 동안 들을 수 있어요',
    );
  });

  it('이미 받은 링크 409 · 만료 410 · 없는 링크 404 (leOn 디자인)', async () => {
    const taken = await makeLink('받힘');
    const b = await devLogin(app, '받은이');
    await request(server())
      .post(`/api/share/${taken.token}/claim`)
      .set(bearer(b.accessToken))
      .set(idem())
      .expect(200);
    const t = await request(server()).get(`/t/${taken.token}`).expect(409);
    expect(t.text).toContain('이미 다른 분이 받은 테이프예요');
    expect(t.text).toContain(
      '<div class="k">받는 사람</div><div class="n">이미 받음</div>',
    );
    expect(t.headers['content-security-policy']).toContain(
      "script-src 'nonce-",
    );

    const expired = await makeLink('만료됨');
    await ds.query(
      `UPDATE deliveries SET share_expires_at = now() - interval '1 minute' WHERE id = $1`,
      [expired.id],
    );
    const e = await request(server()).get(`/t/${expired.token}`).expect(410);
    expect(e.text).toContain('링크가 만료됐어요');
    expect(e.text).toContain('받지 않은 테이프는 7일이 지나면 사라져요.');

    const n = await request(server())
      .get('/t/AAAAAAAAAAAAAAAAAAAAAAAA')
      .expect(404);
    expect(n.text).toContain('테이프를 찾을 수 없어요');
  });

  it('대표 이미지는 /static/og-image.png (PNG)', async () => {
    const res = await request(server()).get('/static/og-image.png').expect(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.body.subarray(1, 4).toString()).toBe('PNG');
  });
});
