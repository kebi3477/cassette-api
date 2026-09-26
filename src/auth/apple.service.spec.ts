import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWK,
  SignJWT,
} from 'jose';
import { APPLE_ISSUER, AppleService } from './apple.service.js';

describe('AppleService', () => {
  const service = new AppleService(
    new ConfigService({
      APPLE_CLIENT_IDS: 'app.tapeletter, app.tapeletter.web',
    }),
  );
  let privateKey: CryptoKey;

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256');
    privateKey = pair.privateKey;
    const jwk: JWK = {
      ...(await exportJWK(pair.publicKey)),
      kid: 'k1',
      alg: 'RS256',
    };
    service.jwks = createLocalJWKSet({ keys: [jwk] });
  });

  const sign = (
    claims: Record<string, unknown>,
    aud = 'app.tapeletter',
    iss = APPLE_ISSUER,
  ) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(iss)
      .setAudience(aud)
      .setSubject('apple-sub-1')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

  it('서명·iss·aud가 맞으면 sub를 돌려준다', async () => {
    const token = await sign({
      email: 'x@privaterelay.appleid.com',
      email_verified: 'true',
    });
    await expect(service.verify(token)).resolves.toEqual({
      sub: 'apple-sub-1',
      email: 'x@privaterelay.appleid.com',
      nickname: null,
    });
  });

  it('aud가 우리 앱이 아니면 거절한다', async () => {
    const token = await sign({}, 'other.app');
    await expect(service.verify(token)).rejects.toMatchObject({
      code: 'SOCIAL_TOKEN_INVALID',
    });
  });

  it('iss가 Apple이 아니면 거절한다', async () => {
    const token = await sign({}, 'app.tapeletter', 'https://evil.example');
    await expect(service.verify(token)).rejects.toMatchObject({
      code: 'SOCIAL_TOKEN_INVALID',
    });
  });

  it('nonce를 sha256으로 비교한다', async () => {
    const raw = 'raw-nonce';
    const token = await sign({
      nonce: createHash('sha256').update(raw).digest('hex'),
    });
    await expect(service.verify(token, raw)).resolves.toMatchObject({
      sub: 'apple-sub-1',
    });
    await expect(service.verify(token, 'wrong')).rejects.toMatchObject({
      code: 'SOCIAL_TOKEN_INVALID',
    });
  });

  it('APPLE_CLIENT_IDS가 없으면 모두 거절한다', async () => {
    const empty = new AppleService(new ConfigService({}));
    empty.jwks = service.jwks;
    await expect(empty.verify(await sign({}))).rejects.toMatchObject({
      code: 'SOCIAL_TOKEN_INVALID',
    });
  });
});
