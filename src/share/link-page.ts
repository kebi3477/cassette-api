import type { WebPreview } from './dto/share.response.js';

const TAPE_NAME: Record<number, string> = { 1: '1분', 3: '3분', 5: '5분' };

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&'
      ? '&amp;'
      : c === '<'
        ? '&lt;'
        : c === '>'
          ? '&gt;'
          : c === '"'
            ? '&quot;'
            : '&#39;',
  );
}

/** 한국 시간 기준 MM.DD */
export function formatMonthDay(isoDate: string): string {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(isoDate));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('month')}.${get('day')}`;
}

export interface StoreLinks {
  appStore: string;
  googlePlay: string;
}

const STYLE = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:SUIT,-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;background:#fff;color:#111;min-height:100vh;display:flex;justify-content:center}
main{width:100%;max-width:430px;padding:28px 24px 30px;display:flex;flex-direction:column;gap:28px}
.brand{display:flex;align-items:center;gap:8px;font-weight:800;font-size:17px}
h1{font-size:26px;font-weight:800;line-height:1.35}
.sub{margin-top:8px;color:#9A9A97;font-weight:500;font-size:15px}
.stage{background:#F6F6F4;border-radius:24px;padding:28px 20px;display:flex;flex-direction:column;align-items:center;gap:16px}
.parcel{width:220px;height:150px;border:0;border-radius:14px;background:#C9A06A;position:relative;cursor:pointer;box-shadow:inset 0 -10px 0 #C29558}
.parcel::before{content:'';position:absolute;left:0;right:0;top:62px;height:22px;background:#EFE4CF}
.label{position:absolute;right:14px;bottom:18px;background:#fff;border-radius:8px;padding:6px 10px;text-align:left;font-size:11px;color:#9A9A97}
.label b{display:block;color:#111;font-size:14px}
.hint{color:#9A9A97;font-size:14px;font-weight:700}
.player{display:none;width:100%;flex-direction:column;align-items:center;gap:14px}
.play{width:60px;height:60px;border-radius:999px;border:0;background:#111;color:#fff;font-size:22px;cursor:pointer}
.bar{display:flex;align-items:center;gap:10px;width:100%;font-variant-numeric:tabular-nums;font-size:13px;color:#9A9A97}
.track{flex:1;height:4px;background:#E6E6E3;border-radius:999px;overflow:hidden}
.fill{height:100%;width:0;background:#E5402B}
.cta h2{font-size:18px;font-weight:800}
.cta p{margin-top:6px;color:#9A9A97;font-weight:500;font-size:14px;line-height:1.5}
.stores{margin-top:16px;display:flex;gap:10px}
.stores a{flex:1;height:56px;border-radius:16px;background:#111;color:#fff;text-decoration:none;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;font-size:15px}
.stores a span{font-size:10px;font-weight:500;opacity:.7}
.foot{color:#B5B5B2;font-size:12px;text-align:center}
.err{color:#E5402B;font-size:13px;font-weight:700;min-height:18px}
`;

const LOGO = `<svg viewBox="0 0 48 48" width="24" height="24" aria-hidden="true"><mask id="m"><rect width="48" height="48" fill="#fff"/><circle cx="14" cy="23" r="3" fill="#000"/><circle cx="34" cy="23" r="3" fill="#000"/></mask><g fill="#E5402B" mask="url(#m)"><circle cx="14" cy="23" r="8.5"/><circle cx="34" cy="23" r="8.5"/><rect x="14" y="29" width="20" height="2.5"/></g></svg>`;

function layout(title: string, body: string, script = ''): string {
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style></head>
<body><main><div class="brand">${LOGO}<span>cassette</span></div>${body}</main>${script}</body></html>`;
}

function stores(links: StoreLinks): string {
  return `<div class="stores"><a href="${escapeHtml(links.appStore)}"><span>다운로드</span>App Store</a><a href="${escapeHtml(links.googlePlay)}"><span>다운로드</span>Google Play</a></div>`;
}

/** 모바일 웹 페이지 (디자인 webOn): 소포 뜯기 → 웹 재생 + 앱 설치 안내 */
export function renderTapePage(
  token: string,
  p: WebPreview,
  links: StoreLinks,
): string {
  const name = escapeHtml(p.senderName);
  const body = `
<section><h1>${name}님이<br>테이프를 보냈어요</h1><p class="sub">${TAPE_NAME[p.tapeType]} 테이프 · ${formatMonthDay(p.sentAt)}</p></section>
<section class="stage">
  <button class="parcel" id="parcel" type="button" aria-label="소포 뜯기"><span class="label">보낸 사람<b>${name}</b></span></button>
  <p class="hint" id="hint">탭해서 뜯기</p>
  <div class="player" id="player">
    <button class="play" id="play" type="button" aria-label="재생">▶</button>
    <div class="bar"><span id="pos">0:00</span><div class="track"><div class="fill" id="fill"></div></div><span id="len">${fmt(p.durationMs)}</span></div>
  </div>
  <p class="err" id="err"></p>
</section>
<section class="cta"><h2>앱에서 답장을 보낼 수 있어요</h2><p>앱을 설치하면 ${name}님과 친구가 되고,<br>이 테이프는 서랍에 담겨요.</p>${stores(links)}</section>
<p class="foot">앱이 없어도 이 페이지에서 7일 동안 들을 수 있어요</p>`;
  const script = `<script>
(function(){
  var token=${JSON.stringify(token)}, audio=null;
  var $=function(id){return document.getElementById(id)};
  function fmt(s){s=Math.floor(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
  function load(){
    $('err').textContent='';
    return fetch('/api/share/'+encodeURIComponent(token)+'/web/audio',{method:'POST'})
      .then(function(r){return r.json().then(function(b){if(!r.ok)throw b;return b})})
      .then(function(b){
        audio=new Audio(b.url);
        audio.addEventListener('timeupdate',function(){
          $('pos').textContent=fmt(audio.currentTime);
          if(audio.duration)$('fill').style.width=(audio.currentTime/audio.duration*100)+'%';
        });
        audio.addEventListener('ended',function(){$('play').textContent='▶'});
      });
  }
  $('parcel').addEventListener('click',function(){
    $('parcel').style.display='none';$('hint').style.display='none';$('player').style.display='flex';
    load().catch(function(e){$('err').textContent=(e&&e.message)||'테이프를 불러오지 못했어요'});
  });
  $('play').addEventListener('click',function(){
    if(!audio){load().then(function(){audio.play();$('play').textContent='❚❚'}).catch(function(e){$('err').textContent=(e&&e.message)||'테이프를 불러오지 못했어요'});return}
    if(audio.paused){audio.play();$('play').textContent='❚❚'}else{audio.pause();$('play').textContent='▶'}
  });
})();
</script>`;
  return layout(`${p.senderName}님이 테이프를 보냈어요`, body, script);
}

const ERROR_PAGE: Record<string, { title: string; sub: string }> = {
  LINK_TAKEN: {
    title: '이미 다른 분이 받은 테이프예요',
    sub: '테이프는 한 사람만 받을 수 있어요.<br>보낸 분께 다시 보내 달라고 해보세요.',
  },
  LINK_EXPIRED: {
    title: '링크가 만료됐어요',
    sub: '받지 않은 테이프는 7일이 지나면 사라져요.<br>보낸 분께 다시 보내 달라고 해보세요.',
  },
  LINK_NOT_FOUND: {
    title: '테이프를 찾을 수 없어요',
    sub: '링크 주소를 다시 확인해 주세요.',
  },
};

export function renderErrorPage(code: string, links: StoreLinks): string {
  const e = ERROR_PAGE[code] ?? ERROR_PAGE.LINK_NOT_FOUND;
  return layout(
    e.title,
    `<section><h1>${e.title}</h1><p class="sub">${e.sub}</p></section><section class="cta"><h2>cassette</h2><p>목소리를 테이프에 담아 보내요.</p>${stores(links)}</section>`,
  );
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
