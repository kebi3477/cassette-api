import {
  escapeHtml,
  formatMonthDay,
  renderErrorPage,
  renderTapePage,
} from './link-page.js';

const links = {
  appStore: 'https://apps.apple.com/app/id1',
  googlePlay: 'https://play.google.com/x',
};

describe('링크 웹 페이지', () => {
  it('HTML을 이스케이프한다', () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;',
    );
    const html = renderTapePage(
      'tok',
      {
        senderName: '<script>',
        tapeType: 3,
        durationMs: 34000,
        tag: null,
        sentAt: '2026-09-25T03:00:00Z',
        expiresAt: '2026-10-02T03:00:00Z',
      },
      links,
    );
    expect(html).not.toContain('<script>님');
    expect(html).toContain('&lt;script&gt;님이<br>테이프를 보냈어요');
    expect(html).toContain('3분 테이프 · 09.25');
    expect(html).toContain('0:34');
    expect(html).toContain('앱이 없어도 이 페이지에서 7일 동안 들을 수 있어요');
  });

  it('날짜는 한국 시간 MM.DD', () => {
    expect(formatMonthDay('2026-09-24T16:00:00Z')).toBe('09.25');
  });

  it('오류 페이지 문구', () => {
    expect(renderErrorPage('LINK_EXPIRED', links)).toContain(
      '링크가 만료됐어요',
    );
    expect(renderErrorPage('LINK_TAKEN', links)).toContain(
      '이미 다른 분이 받은 테이프예요',
    );
  });
});
