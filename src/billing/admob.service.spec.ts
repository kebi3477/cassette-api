import { generateKeyPairSync, sign } from 'node:crypto';
import { AdmobService } from './admob.service.js';

describe('AdmobService.verify', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  const service = new AdmobService();
  service.keySource = () =>
    Promise.resolve(
      new Map([
        ['7', publicKey.export({ type: 'spki', format: 'pem' }).toString()],
      ]),
    );

  const query = (content: string) =>
    `${content}&signature=${sign('sha256', Buffer.from(content), privateKey).toString('base64url')}&key_id=7`;

  it('signature 앞부분 전체를 원래 순서 그대로 검증한다', async () => {
    const q = query(
      'ad_network=1&ad_unit=2&reward_amount=10&reward_item=c&timestamp=1&transaction_id=t1&user_id=u1',
    );
    await expect(service.verify(q)).resolves.toEqual({
      transactionId: 't1',
      userId: 'u1',
      rewardAmount: 10,
      adUnit: '2',
    });
  });

  it('없는 key_id, 서명 없음, 내용 변조는 INVALID_SIGNATURE', async () => {
    const q = query('transaction_id=t1&user_id=u1');
    await expect(
      service.verify(q.replace('key_id=7', 'key_id=8')),
    ).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
    await expect(
      service.verify('transaction_id=t1&user_id=u1'),
    ).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
    await expect(
      service.verify(q.replace('user_id=u1', 'user_id=u2')),
    ).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
  });

  it('서명에 base64url이 아닌 글자를 붙이면 거절한다', async () => {
    const q = query('transaction_id=t9&user_id=u9');
    await expect(service.verify(q)).resolves.toMatchObject({
      transactionId: 't9',
    });
    await expect(
      service.verify(q.replace('&key_id=7', '!&key_id=7')),
    ).rejects.toMatchObject({
      code: 'INVALID_SIGNATURE',
    });
    await expect(
      service.verify(q.replace(/signature=[^&]+/, 'signature=')),
    ).rejects.toMatchObject({
      code: 'INVALID_SIGNATURE',
    });
  });

  it('AdMob처럼 퍼센트 디코딩한 쿼리에 서명해도 받는다 (한글 reward_item)', async () => {
    const encoded =
      'ad_network=1&ad_unit=2&reward_amount=10&reward_item=%ED%81%AC%EB%A0%88%EB%94%A7&timestamp=1&transaction_id=t2&user_id=u2';
    const sig = sign(
      'sha256',
      Buffer.from(decodeURIComponent(encoded)),
      privateKey,
    ).toString('base64url');
    await expect(
      service.verify(`${encoded}&signature=${sig}&key_id=7`),
    ).resolves.toMatchObject({ transactionId: 't2', userId: 'u2' });
    // 디코딩한 내용을 바꾸면 여전히 거절
    await expect(
      service.verify(
        `${encoded.replace('user_id=u2', 'user_id=u3')}&signature=${sig}&key_id=7`,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
  });

  it('user_id가 없는 콜백(콘솔 URL 확인)은 userId null로 통과한다', async () => {
    const q = query(
      'ad_network=1&ad_unit=1234567890&reward_amount=1&reward_item=Reward&timestamp=1&transaction_id=123456789',
    );
    await expect(service.verify(q)).resolves.toMatchObject({
      transactionId: '123456789',
      userId: null,
    });
  });
});
