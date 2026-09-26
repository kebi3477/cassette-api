import { ConfigService } from '@nestjs/config';
import { renderPolicyPage } from './policy.html.js';
import { PolicyService } from './policy.service.js';
import { PENDING } from './types.js';

describe('PolicyService', () => {
  it('운영자 정보가 없으면 "준비 중"', () => {
    const op = new PolicyService(new ConfigService({})).operator();
    expect(op).toEqual({
      operatorName: PENDING,
      contactEmail: PENDING,
      privacyOfficer: PENDING,
      businessInfo: PENDING,
      effectiveDate: PENDING,
    });
  });

  it('운영에서 비어 있으면 경고만 남기고 멈추지 않는다', () => {
    const service = new PolicyService(
      new ConfigService({ NODE_ENV: 'production' }),
    );
    const warn = vi
      .spyOn(service['logger'], 'warn')
      .mockImplementation(() => undefined);
    expect(() => service.onModuleInit()).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('POLICY_OPERATOR_NAME'),
    );
  });

  it('두 문서 모두 법정 항목 순서대로 렌더링되고 초안 표시는 본문에 없다', () => {
    const service = new PolicyService(
      new ConfigService({ POLICY_OPERATOR_NAME: '테이프레터' }),
    );
    const privacy = renderPolicyPage(
      service.privacy(),
      'n',
      'https://x/privacy',
    );
    for (const t of [
      '처리 목적',
      '처리하는 개인정보 항목',
      '보유 및 이용 기간',
      '제3자 제공',
      '국외 이전',
      '파기',
      '정보주체의 권리',
      '안전성 확보',
      '보호책임자',
      '변경',
    ]) {
      expect(privacy).toContain(t);
    }
    const terms = renderPolicyPage(service.terms(), 'n', 'https://x/terms');
    expect(terms).toContain('탈퇴와 재가입');
    expect(privacy + terms).not.toContain('검토 전');
  });
});
