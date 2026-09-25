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
});
