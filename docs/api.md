# Cassette API 계약서

Cassette 앱(`cassette-app`, Flutter)과 이 서버(`cassette-api`) 사이의 **단일 계약서**다. 앱은 이 문서만 보고 맞춘다.
서버를 바꾸면 이 문서를 같은 커밋에서 고친다. 맨 아래 "변경 이력"에 한 줄 남긴다.

- 상태 표시: ✅ 구현됨 · ⏳ 예정 (경로·모양은 확정안이지만 구현하면서 바뀔 수 있다. 바뀌면 변경 이력에 적는다)
- 수치·문구의 정답은 디자인 원본 `design_handoff_cassette_app/source/CassetteApp.logic.js`다.

## 목차
1. [공통 규칙](#1-공통-규칙)
2. [공통 타입](#2-공통-타입)
3. [오류 코드](#3-오류-코드)
4. [엔드포인트 한눈에 보기](#4-엔드포인트-한눈에-보기)
5. [app-version](#5-app-version) · [auth](#6-auth) · [users](#7-users) · [friends](#8-friends) · [recordings](#9-recordings) · [deliveries](#10-deliveries) · [shelf](#11-shelf) · [share](#12-share) · [wallet](#13-wallet) · [shop](#14-shop) · [billing](#15-billing) · [notifications](#16-notifications) · [dev](#17-dev-개발-전용)
6. [화면 → API 대응표](#18-화면--api-대응표-디자인-v2)
7. [회원 탈퇴 데이터 정책](#19-회원-탈퇴-데이터-정책)
8. [변경 이력](#20-변경-이력)

---

## 1. 공통 규칙

| 항목 | 규칙 |
|---|---|
| 기본 주소 | 개발: `http://<맥 IP>:3000/api` · 운영: `https://<도메인>/api` (Cloudflare Tunnel) |
| 전역 prefix | 모든 API는 `/api`로 시작한다. 예외: 링크 웹 페이지 `GET /t/{token}`, `/.well-known/*` |
| 형식 | 요청·응답 모두 JSON (`Content-Type: application/json`), 키는 **camelCase** |
| 날짜 | ISO 8601 UTC 문자열. 예: `"2026-09-25T06:34:46.549Z"`. 화면의 `09.25`는 앱이 기기 시간대로 바꿔 만든다 |
| ID | 모두 UUID 문자열 |
| 테이프 종류 | `tapeType`: 정수 `1` · `3` · `5` (분) |
| 인증 | `Authorization: Bearer <accessToken>`. `@공개`라고 적힌 API만 없어도 된다 |
| 멱등 | 보내기·구매·선물·결제 확인은 `Idempotency-Key` 헤더가 **필수**다 (아래) |
| 빈 응답 | 돌려줄 게 없으면 `204 No Content` |
| 목록 | `{ "items": [...] }`. 페이지가 있으면 `{ "items": [...], "nextCursor": "..." \| null }`, 요청은 `?cursor=&limit=` (limit 기본 30, 최대 100) |
| 모르는 필드 | 요청 본문에 문서에 없는 필드가 있으면 `400 VALIDATION_FAILED` |

### 인증 흐름
1. 카카오/Apple SDK로 로그인 → 받은 토큰을 `POST /auth/kakao` 또는 `POST /auth/apple`로 보낸다.
2. 응답의 `accessToken`(기본 1시간)과 `refreshToken`(기본 60일)을 안전한 저장소(Keychain/Keystore)에 둔다.
3. API가 `401 UNAUTHORIZED`를 주면 `POST /auth/refresh`로 새 토큰 쌍을 받고 원래 요청을 한 번 다시 보낸다.
   - refresh token은 **한 번 쓰면 사라진다**(회전). 새로 받은 refresh token으로 바꿔 저장한다.
   - 동시에 여러 요청이 401을 받으면 refresh는 한 번만 부르고 나머지는 기다리게 한다(단일 비행).
4. refresh도 `401 INVALID_REFRESH_TOKEN`이면 로그인 화면으로 보낸다.
5. `user.name`이 `null`이면 이름 정하기 화면(`auName`)부터 시작한다.

### 멱등 (`Idempotency-Key`)
- 값: 요청마다 새로 만든 UUID v4 (8~255자, `[A-Za-z0-9_-:.]`). **재시도할 때는 같은 값**을 쓴다.
- 서버는 (사용자, 키)로 첫 응답을 저장해 두었다가, 같은 키로 다시 오면 처리하지 않고 **첫 응답을 그대로** 돌려준다. 이때 응답 헤더 `Idempotent-Replayed: true`가 붙는다.
- 첫 요청이 오류로 끝났으면 키는 풀린다(같은 키로 다시 시도 가능).
- 같은 키를 다른 본문·경로에 쓰면 `422 IDEMPOTENCY_KEY_REUSED`, 첫 요청이 아직 처리 중이면 `409 IDEMPOTENCY_IN_PROGRESS`(잠시 뒤 같은 키로 재시도).
- 헤더가 없으면 `400 IDEMPOTENCY_KEY_REQUIRED`.
- 저장 기간: 24시간 (⏳ 오래된 키 정리 작업은 3단계에서).

### 오류 형식
모든 오류는 같은 모양이다.
```json
{ "code": "INSUFFICIENT_CREDITS", "message": "크레딧이 부족해요", "need": 20 }
```
- `code`: 대문자 스네이크. **앱은 `code`로 분기한다.**
- `message`: 디자인 톤의 한국어. 그대로 토스트에 띄워도 된다.
- 일부 오류는 화면에 필요한 값을 함께 준다 (표의 "추가 필드").
- `5xx`는 서버 오류 화면(`serverOn`, 다시 시도), 네트워크 끊김은 오프라인 배너(`offlineOn`)로 처리한다.

---

## 2. 공통 타입

### Me ✅
`GET /users/me`, 로그인 응답의 `user`.
```json
{
  "id": "d3d62aa5-39ec-41ac-b771-f642d4ac4b87",
  "name": "민경",
  "credits": 120,
  "drawer": { "stored": 11, "cap": 12, "full": false, "unopenedCount": 1 },
  "tapes": [
    { "tapeType": 1, "qty": null },
    { "tapeType": 3, "qty": 2 },
    { "tapeType": 5, "qty": 0 }
  ],
  "stats": { "receivedCount": 11, "sentCount": 4, "friendCount": 6 },
  "providers": ["kakao"],
  "notificationsEnabled": true,
  "createdAt": "2026-09-01T03:00:00.000Z"
}
```
| 필드 | 설명 |
|---|---|
| `name` | 친구에게 보이는 이름, 최대 8자. 가입 직후 `null` |
| `drawer.stored` | 보관 중인 테이프 수(분류 안 함 + 모든 칸) |
| `drawer.full` | `stored >= cap`. 서랍 꽉 참 배너(`fullOn`) |
| `drawer.unopenedCount` | "분류 안 함"의 안 뜯은 소포 수. 탭바 서랍 레드 점(`hasNew`) — 앱은 탭바 때문에 이 API를 자주 불러도 된다 |
| `tapes` | 보유 테이프. 1분은 무제한이라 `qty: null`("무료") |
| `stats.receivedCount` | 받은 테이프 수 = 보관량 (디자인과 같음) |
| `stats.sentCount` | 보낸 테이프 수 (링크로 보낸 것 포함) |
| `stats.friendCount` | 친구 수 (차단한 사람 제외) |
| `providers` | 연결된 계정 (`kakao` · `apple` · `dev`) — 설정 > 연결된 계정 |

### Friend ✅
```json
{ "userId": "7347352a-…", "name": "지현", "starred": true, "lastAt": "2026-09-24T09:00:00.000Z" }
```
- `lastAt`: 마지막으로 테이프를 주고받은 시각. 없으면 `null` ("최근 -")
- 이름을 아직 안 정한 사용자는 `name: "이름 없음"`

### BlockedUser ✅
```json
{ "userId": "…", "name": "민수", "blockedAt": "2026-09-25T06:00:00.000Z" }
```

### Tag ✅
테이프 라벨 태그. 서버는 코드만 저장하고 문구는 앱이 가진다.
| code | 앱 문구 (`TAGS`) |
|---|---|
| `birthday` | 생일 축하해 |
| `congrats` | 축하해요 |
| `thinking` | 그냥, 생각나서 |

### ShelfItem (받은 테이프) ✅
```json
{
  "id": "delivery uuid",
  "sender": { "userId": "…", "name": "지현" },
  "tapeType": 3,
  "durationMs": 34000,
  "tag": "birthday",
  "sentAt": "2026-09-24T09:00:00.000Z",
  "opened": false,
  "openedAt": null,
  "viaLink": false,
  "groupId": null
}
```
- `groupId: null` = "분류 안 함". `opened: false`면 소포 상태(`boxed`, "소포 도착")
- 보낸 사람이 탈퇴했으면 `sender.userId: null`, `name`은 보낼 때의 이름
- `durationMs`: **변환 후 ffprobe로 잰 실제 길이**. 재생 화면은 이 값을 쓴다(디자인의 `DUR`은 쓰지 않는다)
- `viaLink`: 링크로 받은 테이프(소포 화면의 `viaLink` 칩)

### SentTape (보낸 테이프) ✅
```json
{
  "id": "delivery uuid",
  "recipient": { "userId": "…", "name": "엄마" },
  "linkName": null,
  "tapeType": 3,
  "durationMs": 120000,
  "tag": "thinking",
  "sentAt": "2026-09-10T09:00:00.000Z",
  "status": "opened",
  "claimedAt": "2026-09-10T09:00:00.000Z",
  "openedAt": "2026-09-11T02:00:00.000Z",
  "share": null
}
```
| status | 목록 문구 | 상세 문구(`sdStatus`) |
|---|---|---|
| `link_pending` | 링크 대기 | 아직 아무도 받지 않았어요 (+ 링크 다시 공유하기) |
| `link_expired` | 링크 만료 | 링크가 만료됐어요 |
| `unopened` | 안 뜯음 | 아직 소포를 안 뜯었어요 |
| `opened` | `MM.DD 들음` | `MM.DD에 들었어요` |

- 링크로 보냈으면 `recipient`는 받기 전까지 `null`, `linkName`은 라벨에 적은 이름, `share`는 `{ "url", "expiresAt" }`
- **재생 URL은 없다.** 보낸 사람은 들을 수 없다("테이프는 이제 받는 사람만 들을 수 있어요")
- 받는 사람이 나를 차단해서 전달되지 않은 테이프도 계속 `unopened`로 보인다
- 받는 사람이 서랍에서 지워도 보낸 테이프 목록에는 남는다. 받는 사람이 탈퇴하면 목록에서 사라진다

### LedgerEntry ⏳
```json
{ "id": "…", "delta": -30, "reason": "3분 테이프 구매", "kind": "tape_purchase", "createdAt": "…" }
```
| kind | reason 문구 (디자인 원본) |
|---|---|
| `signup_gift` | 가입 선물 (✅ 가입할 때 10 크레딧 지급) |
| `ad_reward` | 광고 보상 |
| `iap` | 크레딧 충전 · ₩1,100 |
| `tape_purchase` | 3분 테이프 구매 / 3분 테이프 5개 구매 / 5분 테이프 구매 / 5분 테이프 5개 구매 |
| `drawer_expand` | 서랍 넓히기 |
| `gift_sent` | {이름}님에게 선물 |
| `gift_received` | {이름}님이 선물 |

앱은 `delta > 0`이면 `+10`(잉크), 아니면 `−30`(회색)으로 그린다.

---

## 3. 오류 코드

| code | HTTP | message | 추가 필드 | 상태 |
|---|---|---|---|---|
| `VALIDATION_FAILED` | 400 | 입력한 내용을 다시 확인해 주세요 | `fields: string[]` | ✅ |
| `UNAUTHORIZED` | 401 | 다시 로그인해 주세요 | | ✅ |
| `FORBIDDEN` | 403 | 할 수 없는 요청이에요 | | ✅ |
| `NOT_FOUND` | 404 | 찾을 수 없어요 | | ✅ |
| `RATE_LIMITED` | 429 | 잠시 후에 다시 시도해 주세요 | | ✅ |
| `INTERNAL_ERROR` | 500 | 잠시 문제가 생겼어요. 다시 시도해 주세요 | | ✅ |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | 요청을 다시 보내 주세요 | | ✅ |
| `IDEMPOTENCY_KEY_REUSED` | 422 | 이미 다른 요청에 쓴 키예요 | | ✅ |
| `IDEMPOTENCY_IN_PROGRESS` | 409 | 처리하고 있어요. 잠시만 기다려 주세요 | | ✅ |
| `SOCIAL_TOKEN_INVALID` | 401 | 로그인하지 못했어요. 다시 시도해 주세요 | | ✅ |
| `SOCIAL_PROVIDER_UNAVAILABLE` | 503 | 로그인 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요 | | ✅ |
| `INVALID_REFRESH_TOKEN` | 401 | 다시 로그인해 주세요 | | ✅ |
| `USER_NOT_FOUND` | 404 | 찾을 수 없는 사용자예요 | | ✅ |
| `INVALID_NAME` | 400 | 이름은 1~8자로 적어주세요 | | ✅ |
| `FRIEND_NOT_FOUND` | 404 | 친구 목록에 없는 사람이에요 | | ✅ |
| `CANNOT_BLOCK_SELF` | 400 | 나는 차단할 수 없어요 | | ✅ |
| `BLOCK_NOT_FOUND` | 404 | 차단한 친구가 아니에요 | | ✅ |
| `INSUFFICIENT_CREDITS` | 402 | 크레딧이 부족해요 | `need: number` (모자란 크레딧, charge 시트) | ✅ (구매 API는 ⏳) |
| `NO_TAPE_LEFT` | 409 | 테이프가 없어요. 상점에서 채워 주세요 | `tapeType` | ✅ |
| `RECORDING_NOT_FOUND` | 404 | 녹음을 찾을 수 없어요 | | ✅ |
| `RECORDING_NOT_READY` | 409 | 테이프 소리로 바꾸는 중이에요 | `status` | ✅ |
| `RECORDING_TOO_LONG` | 400 | 테이프 길이를 넘었어요 | | ✅ |
| `RECORDING_TOO_LARGE` | 400 | 녹음 파일이 너무 커요 | | ✅ |
| `RECORDING_ALREADY_SENT` | 409 | 이미 보낸 녹음이에요 | | ✅ |
| `UPLOAD_NOT_FOUND` | 409 | 녹음 파일을 올리지 못했어요. 다시 시도해 주세요 | | ✅ |
| `NOT_FRIEND` | 403 | 친구에게만 보낼 수 있어요 | | ✅ |
| `TAPE_NOT_FOUND` | 404 | 테이프를 찾을 수 없어요 | | ✅ |
| `TAPE_NOT_OPENED` | 409 | 소포를 먼저 뜯어 주세요 | | ✅ |
| `AUDIO_NOT_READY` | 409 | 테이프를 불러오지 못했어요 | | ✅ |
| `GROUP_NOT_FOUND` | 404 | 칸을 찾을 수 없어요 | | ✅ |
| `INVALID_GROUP_NAME` | 400 | 칸 이름은 1~12자로 적어주세요 | | ✅ |
| `LINK_NOT_FOUND` | 404 | 링크를 찾을 수 없어요 | | ✅ |
| `LINK_TAKEN` | 409 | 이미 다른 분이 받은 테이프예요 | | ✅ |
| `LINK_EXPIRED` | 410 | 링크가 만료됐어요 | | ✅ |
| `LINK_OWN` | 409 | 내가 보낸 테이프예요 | `deliveryId`, `url` | ✅ |
| `INVALID_GIFT_AMOUNT` | 400 | 선물은 10, 30, 50, 100 크레딧만 할 수 있어요 | | ⏳ |
| `PRODUCT_NOT_FOUND` | 404 | 없는 상품이에요 | | ⏳ |
| `AD_LIMIT_REACHED` | 429 | 오늘은 다 받았어요 | | ⏳ |
| `RECEIPT_INVALID` | 400 | 결제를 확인하지 못했어요 | | ⏳ |
| `RECEIPT_PENDING` | 409 | 결제를 확인하고 있어요. 잠시 후 다시 시도해 주세요 | | ⏳ |

---

## 4. 엔드포인트 한눈에 보기

| 상태 | 메서드 | 경로 | 설명 |
|---|---|---|---|
| ✅ | GET | `/health` | 헬스 체크 @공개 |
| ✅ | GET | `/app-version` | 강제 업데이트 확인 @공개 |
| ✅ | POST | `/auth/kakao` | 카카오 로그인 @공개 |
| ✅ | POST | `/auth/apple` | Apple 로그인 @공개 |
| ✅ | POST | `/auth/dev` | 개발 전용 로그인 @공개 (운영 404) |
| ✅ | POST | `/auth/refresh` | 토큰 갱신 @공개 |
| ✅ | POST | `/auth/logout` | 로그아웃 @공개 |
| ✅ | GET | `/users/me` | 내 정보 |
| ✅ | PATCH | `/users/me` | 이름 수정, 알림 켜기/끄기 |
| ✅ | DELETE | `/users/me` | 회원 탈퇴 |
| ✅ | GET | `/friends` | 친구 목록 |
| ✅ | PATCH | `/friends/{userId}` | 즐겨찾기 |
| ✅ | DELETE | `/friends/{userId}` | 목록에서 빼기 |
| ✅ | POST | `/friends/{userId}/block` | 차단 |
| ✅ | DELETE | `/friends/{userId}/block` | 차단 해제 |
| ✅ | GET | `/friends/blocks` | 차단한 친구 목록 |
| ✅ | GET | `/friends/{userId}/tapes` | 친구 화면 (그 친구가 보낸 테이프) |
| ✅ | POST | `/recordings` | 녹음 업로드 URL 발급 |
| ✅ | POST | `/recordings/{id}/complete` | 업로드 완료 → 변환 시작 |
| ✅ | GET | `/recordings/{id}` | 변환 상태 + 미리 듣기 URL |
| ✅ | POST | `/recordings/{id}/retry` | 변환 다시 시도 |
| ✅ | POST | `/deliveries` | 테이프 보내기 (친구 / 링크) 🔑 |
| ✅ | GET | `/deliveries/sent` | 보낸 테이프 목록 |
| ✅ | GET | `/deliveries/sent/{id}` | 보낸 테이프 상세 |
| ✅ | POST | `/deliveries/sent/{id}/share` | 링크 다시 공유하기 |
| ✅ | GET | `/deliveries/{id}` | 받은 테이프 하나 |
| ✅ | POST | `/deliveries/{id}/open` | 소포 뜯기 |
| ✅ | GET | `/deliveries/{id}/audio` | 재생 URL (받는 사람만) |
| ✅ | GET | `/shelf` | 서랍 전체 (분류 안 함 + 칸) |
| ✅ | POST | `/shelf/groups` | 칸 만들기 |
| ✅ | PATCH | `/shelf/groups/{id}` | 칸 이름 바꾸기 / 순서 |
| ✅ | DELETE | `/shelf/groups/{id}` | 칸 지우기 |
| ✅ | PATCH | `/shelf/items/{id}` | 테이프 옮기기·정렬 |
| ✅ | DELETE | `/shelf/items/{id}` | 테이프 지우기 |
| ✅ | GET | `/share/{token}` | 링크 열기(앱) |
| ✅ | POST | `/share/{token}/claim` | 링크 테이프 받기 → 서로 친구 🔑 |
| ✅ | GET | `/share/{token}/web` | 링크 미리보기(웹) @공개 |
| ✅ | POST | `/share/{token}/web/audio` | 웹 재생 URL @공개 |
| ✅ | GET | `/t/{token}` | 모바일 웹 페이지(HTML, `/api` 밖) @공개 |
| ✅ | GET | `/.well-known/apple-app-site-association` · `/.well-known/assetlinks.json` | 유니버설 링크·앱 링크 (`/api` 밖, 환경 변수가 없으면 404) @공개 |
| ⏳ | GET | `/wallet` | 잔액 + 오늘 남은 광고 |
| ⏳ | GET | `/wallet/ledger` | 크레딧 내역 |
| ⏳ | POST | `/wallet/gifts` | 크레딧 선물 🔑 |
| ⏳ | GET | `/shop/products` | 상품 목록 |
| ⏳ | POST | `/shop/purchases` | 테이프 사기 / 서랍 넓히기 🔑 |
| ⏳ | POST | `/billing/iap` | 인앱 결제 영수증 확인 → 크레딧 충전 🔑 |
| ⏳ | GET | `/billing/admob/ssv` | AdMob 광고 보상 콜백 @공개(서명 검증) |
| ⏳ | POST | `/billing/apple/notifications` | App Store 서버 알림(환불) @공개(서명 검증) |
| ⏳ | POST | `/billing/google/rtdn` | Google Play 실시간 알림(환불) @공개(Pub/Sub 인증) |
| ⏳ | PUT | `/notifications/devices` | FCM 토큰 등록 |
| ⏳ | DELETE | `/notifications/devices/{token}` | FCM 토큰 해제 |
| ✅ | POST | `/dev/friends` | 개발 전용: 가짜 친구 만들기 (운영 404) |

🔑 = `Idempotency-Key` 필수

---

## 5. app-version

### ✅ `GET /app-version` @공개
앱 시작 시(스플래시) 로그인 전에 부른다. `updateRequired: true`면 강제 업데이트 화면(`updateOn`) → "업데이트하기"는 `storeUrl`을 연다.

쿼리
| 이름 | 필수 | 설명 |
|---|---|---|
| `platform` | O | `ios` \| `android` |
| `version` | | 지금 앱 버전 `x.y.z`. 주면 `updateRequired`·`updateAvailable`을 계산한다 |

응답 `200`
```json
{
  "platform": "ios",
  "minVersion": "1.0.0",
  "latestVersion": "1.2.0",
  "storeUrl": "https://apps.apple.com/app/id0000000000",
  "updateRequired": false,
  "updateAvailable": true
}
```
`version`을 안 주면 `updateRequired`, `updateAvailable`은 `null`. 값은 서버 환경 변수(`APP_MIN_VERSION_IOS` 등)로 바꾼다.

---

## 6. auth

모든 로그인 응답은 `AuthResponse`다.
```json
{
  "accessToken": "eyJ…",
  "accessTokenExpiresAt": "2026-09-25T07:34:46.490Z",
  "refreshToken": "ujlqfa6QZNdO…",
  "refreshTokenExpiresAt": "2026-11-24T06:34:46.490Z",
  "isNewUser": true,
  "suggestedName": "민경",
  "user": { "…": "Me" }
}
```
- `isNewUser`: 이번에 가입했으면 `true`. 가입하면 **가입 선물 10 크레딧**이 들어온다(내역 "가입 선물").
- `suggestedName`: 이름 정하기 화면에 미리 채울 이름(카카오 닉네임 앞 8자). 없으면 `null`.
- `user.name == null`이면 이름 정하기 → `PATCH /users/me { name }`.

### ✅ `POST /auth/kakao` @공개
카카오 SDK의 액세스 토큰을 보낸다. 서버가 `kapi.kakao.com`에 물어 우리 앱(`KAKAO_APP_ID`)의 토큰인지 확인한다.
```json
{ "accessToken": "카카오 액세스 토큰" }
```
응답 `200 AuthResponse` · 오류 `401 SOCIAL_TOKEN_INVALID`, `503 SOCIAL_PROVIDER_UNAVAILABLE`

### ✅ `POST /auth/apple` @공개
`sign_in_with_apple`의 `identityToken`을 보낸다. 서버가 Apple 공개 키(JWKS)로 서명·`iss`·`aud`(번들 ID)·만료를 검사한다.
```json
{ "identityToken": "eyJ…", "nonce": "원문 nonce (선택)" }
```
- `nonce`: Apple에 `sha256(nonce)`를 넘겼다면 원문을 같이 보낸다(재전송 공격 방지, 권장).
- Apple은 이름을 토큰에 넣지 않는다. 첫 로그인 때 SDK가 준 이름은 앱이 이름 정하기 화면에 미리 채운다.

응답 `200 AuthResponse` · 오류 `401 SOCIAL_TOKEN_INVALID`, `503 SOCIAL_PROVIDER_UNAVAILABLE`

### ✅ `POST /auth/dev` @공개 · 개발 전용
`NODE_ENV=production`이면 `404 NOT_FOUND`. 앱 개발과 e2e 테스트용.
```json
{ "key": "minkyung", "name": "민경" }
```
- `key`: `[A-Za-z0-9_-]{1,64}`. 같은 key면 같은 사용자.
- `name`: 선택. **처음 만들 때만** 이름으로 쓴다(1~8자). 없으면 `name: null`로 가입.

응답 `200 AuthResponse`

### ✅ `POST /auth/refresh` @공개
```json
{ "refreshToken": "…" }
```
응답 `200`
```json
{ "accessToken": "…", "accessTokenExpiresAt": "…", "refreshToken": "새 값", "refreshTokenExpiresAt": "…" }
```
쓴 refresh token은 바로 사라진다. 오류 `401 INVALID_REFRESH_TOKEN` → 로그인 화면.

### ✅ `POST /auth/logout` @공개
이 기기의 refresh token을 지운다. access token은 만료(최대 1시간)까지 남으니 앱에서 지운다.
⏳ 2단계부터는 로그아웃 전에 `DELETE /notifications/devices/{token}`도 부른다.
```json
{ "refreshToken": "…" }
```
응답 `204`

---

## 7. users

### ✅ `GET /users/me`
응답 `200 Me`. 마이 탭(`vMy`), 녹음 탭의 테이프 개수 알약, 상점의 "지금 11/12"에 쓴다.

### ✅ `PATCH /users/me`
바꿀 필드만 보낸다.
```json
{ "name": "민경", "notificationsEnabled": false }
```
- `name`: 앞뒤 공백을 빼고 1~8자(한글·이모지도 한 글자). 어기면 `400 INVALID_NAME`
- `notificationsEnabled`: 마이 > 알림 토글. 끄면 테이프 도착·선물 푸시를 보내지 않는다

응답 `200 Me`

### ✅ `DELETE /users/me`
회원 탈퇴(`shWithdraw`에서 체크 후 "탈퇴하기"). 응답 `204` → 앱은 저장한 토큰을 지우고 로그인 화면으로.
탈퇴하면 그 계정의 access·refresh token은 즉시 쓸 수 없다(`401`). 지워지는 것은 [19. 회원 탈퇴 데이터 정책](#19-회원-탈퇴-데이터-정책).

---

## 8. friends

친구는 "테이프를 주고받은 사이"다. 친구 추가 API는 따로 없고, **링크 테이프를 받으면(claim) 서로 친구**가 된다. 친구에게 테이프를 보내거나 받으면 `lastAt`이 갱신된다.
관계는 방향이 있다. 내가 목록에서 빼거나 차단해도 상대 목록에는 내가 남는다.

### ✅ `GET /friends`
녹음 > 받는 사람(`vPick`), 마이 > 친구(`myFriends`).
정렬: 즐겨찾기 먼저 → `lastAt` 최근 순(없으면 뒤) → 친구가 된 최근 순.
**내가 차단한 사람은 나오지 않는다**(차단 해제 전까지).
```json
{ "items": [ { "userId": "…", "name": "지현", "starred": true, "lastAt": "2026-09-24T09:00:00.000Z" } ] }
```
화면 부제: 즐겨찾기면 `즐겨찾기 · MM.DD`, 아니면 `최근 MM.DD`.

### ✅ `PATCH /friends/{userId}`
즐겨찾기(☆/★). 토글은 앱이 현재 값을 뒤집어 보낸다.
```json
{ "starred": true }
```
응답 `200 Friend` · 오류 `404 FRIEND_NOT_FOUND`

### ✅ `DELETE /friends/{userId}`
친구 시트 > "목록에서 빼기". 응답 `204` · 오류 `404 FRIEND_NOT_FOUND`
받은 테이프는 그대로 남는다. 그 사람이 다시 테이프를 보내면 목록에 다시 나타난다.

### ✅ `POST /friends/{userId}/block`
친구 시트 ⋯ > 차단(`shBlock`) → "차단하기". 친구가 아니어도(예: 링크로 받은 사람) 차단할 수 있다.
- 내 친구 목록에서 빠지고 차단 목록에 들어간다. 이미 차단했으면 그대로 `200`
- 차단한 사람이 보내는 테이프는 받지 않는다(보낸 쪽에는 정상 발송처럼 보이고, 내 서랍에는 들어오지 않는다). 선물은 ⏳ 3단계
- 상대에게는 알리지 않는다

응답 `200 BlockedUser` · 오류 `400 CANNOT_BLOCK_SELF`, `404 USER_NOT_FOUND`

### ✅ `GET /friends/blocks`
설정 > 차단한 친구(`shBlocked`). 최근에 차단한 순. 설정 행의 "N명 / 없음"은 `items.length`.
```json
{ "items": [ { "userId": "…", "name": "민수", "blockedAt": "2026-09-25T06:00:00.000Z" } ] }
```

### ✅ `DELETE /friends/{userId}/block`
차단 해제("해제"). 차단하기 전에 친구였다면 **즐겨찾기·lastAt까지 그대로** 친구 목록으로 돌아온다.
응답 `204` · 오류 `404 BLOCK_NOT_FOUND`

### ✅ `GET /friends/{userId}/tapes`
친구 화면(`fvOn`): 그 친구가 나에게 보낸 테이프 중 뜯은 것(모든 칸 + 분류 안 함), "모두 재생" 목록.
```json
{
  "friend": { "userId": "…", "name": "엄마", "starred": true, "lastAt": "…" },
  "items": [ { "…": "ShelfItem", "groupName": "엄마 목소리" } ],
  "unopenedCount": 1
}
```
부제: `받은 테이프 N개 · 뜯지 않은 테이프 M개`, 둘 다 0이면 "받은 테이프 없음". 오류 `404 FRIEND_NOT_FOUND`

---

## 9. recordings

녹음 파일은 앱이 저장소(MinIO / R2)에 **직접** 올린다(presigned PUT). 형식은 AAC(m4a) 64kbps 권장, 최대 6MB.
변환 워커(BullMQ)가 ffmpeg로 "테이프 소리"(대역 제한 · 히스 노이즈 · 약한 wow/flutter · 새추레이션)를 입히고, **ffprobe로 잰 실제 길이로 `durationMs`를 바꾼다.**

### Recording
```json
{
  "id": "recording uuid",
  "tapeType": 3,
  "durationMs": 95000,
  "status": "ready",
  "preview": { "url": "https://…presigned GET…", "expiresAt": "…(10분)" }
}
```
| status | 화면 |
|---|---|
| `uploading` | 업로드 URL을 받았고 아직 `complete` 전 |
| `processing` | 변환 중 (`conv`) |
| `ready` | 미리 듣기(`preview` 있음) → "누구에게 보낼까요?" |
| `failed` | 변환 실패(`convFailOn`): 다시 시도 → `POST /recordings/{id}/retry` · 처음부터 다시 녹음(새 `POST /recordings`) |

- `durationMs`: `ready`가 되면 실제 파일 길이로 바뀐다. 확인 화면·재생 화면은 이 값을 쓴다
- `preview`: `ready`이고 **아직 보내지 않은** 녹음의 주인에게만. 보낸 뒤에는 `null`
- 서버는 변환을 3번까지 시도하고, 모두 실패하면 `failed`로 바꾼다. 실제 길이가 테이프 한도(+1.5초)를 넘어도 `failed`

### ✅ `POST /recordings`
녹음을 멈추면 부른다.
```json
{ "tapeType": 3, "durationMs": 95000, "contentType": "audio/mp4" }
```
- `contentType`: `audio/mp4` · `audio/m4a` · `audio/x-m4a` · `audio/aac`
- `durationMs ≤ 한도 + 1,000` (1분 60,000 · 3분 180,000 · 5분 300,000). 넘으면 `400 RECORDING_TOO_LONG`
- 3·5분 테이프를 가졌는지는 **보낼 때** 확인한다(녹음은 자유)

응답 `201` = Recording + `upload`
```json
{
  "id": "…", "tapeType": 3, "durationMs": 95000, "status": "uploading", "preview": null,
  "upload": {
    "url": "https://…presigned PUT…",
    "method": "PUT",
    "headers": { "Content-Type": "audio/mp4" },
    "expiresAt": "…(15분)"
  }
}
```
`upload.headers`는 서명에 들어가 있으니 **그대로** 붙여서 PUT한다(본문은 파일 바이트).

### ✅ `POST /recordings/{id}/complete`
PUT이 끝나면 부른다. 서버가 파일이 있는지·크기를 확인하고 변환 큐에 넣는다. 응답 `200 Recording` (`status: "processing"`). 이미 넘어간 상태면 지금 상태를 그대로 준다.
오류 `409 UPLOAD_NOT_FOUND`(파일이 없음 → PUT 다시), `400 RECORDING_TOO_LARGE`(6MB 초과), `404 RECORDING_NOT_FOUND`

### ✅ `GET /recordings/{id}`
확인 화면(`vConfirm`)이 **1초 간격으로 폴링**한다(롱폴링 없음). "테이프 소리로 바꾸는 중…"은 `ready`가 될 때까지, **최소 1.4초** 보여 준다. 1.4초를 넘기면 대기 표현(`convSlowOn`). 응답 `200 Recording`

### ✅ `POST /recordings/{id}/retry`
`failed`인 녹음을 다시 변환한다. 다른 상태면 지금 상태를 그대로 준다. 응답 `200 Recording`

---

## 10. deliveries

### ✅ `POST /deliveries` 🔑
라벨 화면(`vLabel`)의 "보내기". 한 트랜잭션에서 **녹음 확인 → 친구·차단 확인 → 보유 테이프 1개 차감(3·5분만, 1분은 무료) → 테이프 생성 → 친구 `lastAt` 갱신**, 끝나면 받는 사람에게 푸시(⏳ 3단계, 지금은 호출 지점만).

친구에게:
```json
{ "recordingId": "…", "recipientId": "friend userId", "tag": "birthday" }
```
새 친구에게 링크로 (`vPick` > "새 친구에게 링크로 보내기"):
```json
{ "recordingId": "…", "linkName": "유진", "tag": "birthday" }
```
- `recipientId`와 `linkName` 중 하나만. `linkName`은 라벨에 적힌 이름(1~8자). `tag`는 선택
- 받는 사람 서랍이 꽉 차도 보낸다("분류 안 함" 맨 위에 들어가고, 받는 쪽 앱이 배너를 띄운다)
- 받는 사람이 나를 차단했어도 `201`로 보인다(받는 쪽에는 들어가지 않는다)
- 받는 사람이 나를 목록에서 뺐었다면 테이프가 도착하면서 다시 친구 목록에 나타난다

응답 `201 SentTape` (링크면 `share.url`로 카카오톡/문자 공유 시트를 연다)
오류 `409 NO_TAPE_LEFT`(+`tapeType`), `409 RECORDING_NOT_READY`(+`status`), `409 RECORDING_ALREADY_SENT`, `403 NOT_FRIEND`, `404 RECORDING_NOT_FOUND`, `400 INVALID_NAME`
보내기 실패(`sendFailOn`) → "다시 보내기"는 **같은 `Idempotency-Key`**로 재시도한다. 이미 처리된 요청이면 첫 응답이 그대로 온다(`Idempotent-Replayed: true`, 테이프는 한 번만 차감).

### ✅ `GET /deliveries/sent?cursor=&limit=`
마이 > 보낸 테이프. 최근 순. `{ "items": [SentTape], "nextCursor": "…" | null }`

### ✅ `GET /deliveries/sent/{id}`
보낸 테이프 상세(`shSentDetail`). `200 SentTape` · `404 TAPE_NOT_FOUND`

### ✅ `POST /deliveries/sent/{id}/share`
"링크 다시 공유하기". 아직 아무도 받지 않은 링크 테이프만. 만료 전이면 같은 링크를, 만료됐으면 **새 링크(7일)**를 준다(옛 링크는 `LINK_NOT_FOUND`가 된다).
응답 `200 { "url": "https://<도메인>/t/…", "expiresAt": "…" }` · 받은 뒤면 `409 LINK_TAKEN`

### ✅ `GET /deliveries/{id}`
받은 테이프 하나(푸시를 눌러 들어올 때). `200 ShelfItem` · `404 TAPE_NOT_FOUND`

### ✅ `POST /deliveries/{id}/open`
소포 뜯기(`unwrap`). 처음 한 번만 `openedAt`을 채우고, 보낸 사람의 보낸 테이프 상태가 `opened`가 된다. 응답 `200 ShelfItem`

### ✅ `GET /deliveries/{id}/audio`
재생 URL. **받는 사람만**, 뜯은 테이프만. 짧은 만료(10분)라서 곡을 넘길 때마다 부른다. 앱은 한 번 받은 파일을 캐시한다.
```json
{ "url": "https://…presigned GET…", "expiresAt": "…", "durationMs": 34000 }
```
불러오는 중(`vLoadingOn`) → 실패하면 `vErrorOn`("다시 시도"). 오류 `404 TAPE_NOT_FOUND`(보낸 사람이 불러도 404), `409 TAPE_NOT_OPENED`, `409 AUDIO_NOT_READY`

---

## 11. shelf

서랍 = "분류 안 함"(`groupId: null`) + 사용자 칸. 칸 안의 순서와 칸의 순서는 서버가 fractional index로 관리하고, 앱은 **배열 순서 그대로** 그린다.

### ✅ `GET /shelf`
```json
{
  "stored": 11,
  "cap": 12,
  "full": false,
  "unopenedCount": 1,
  "unsorted": [ShelfItem],
  "groups": [ { "id": "…", "name": "2026 생일", "items": [ShelfItem] } ]
}
```
- 새로 도착한 테이프는 "분류 안 함" **맨 위**
- `full: true`면 꽉 참 배너(`fullOn`) "지우거나 넓혀야 새 테이프를 받을 수 있어요" → 넓히기 → 상점
- `stored == 0`이면 빈 서랍(`emptyOn`)
- `unopenedCount`: "분류 안 함"의 안 뜯은 소포 수(= `Me.drawer.unopenedCount`)

### ✅ `POST /shelf/groups`
칸 추가(무료, 맨 뒤에 붙는다). `{ "name": "2026 생일" }` (1~12자, 비우거나 빼면 "새 칸") → `201 { "id", "name", "items": [] }` · `400 INVALID_GROUP_NAME`

### ✅ `PATCH /shelf/groups/{id}`
`{ "name": "새 이름" }` 그리고/또는 순서 `{ "afterId": "바로 앞 칸 id" | null }` (null = 맨 앞) → `200 { "id", "name", "items" }` · `404 GROUP_NOT_FOUND`

### ✅ `DELETE /shelf/groups/{id}`
칸 지우기. 안에 있던 테이프는 "분류 안 함"의 **끝**으로 가고 뜯은 상태가 된다("칸을 지웠어요 · 테이프는 분류 안 함으로"). `204`

### ✅ `PATCH /shelf/items/{id}`
드래그 정렬, 옮기기 시트(`shMove`). 둘 다 **필수**(null 가능).
```json
{ "groupId": "칸 id 또는 null(분류 안 함)", "afterId": "바로 앞 테이프 id 또는 null(맨 앞)" }
```
응답 `200 ShelfItem`. 앱은 낙관적으로 먼저 옮기고, 실패하면 되돌린다.
오류 `409 TAPE_NOT_OPENED`(안 뜯은 소포는 칸으로 못 옮긴다. "분류 안 함" 안에서 순서 바꾸기는 된다), `404 TAPE_NOT_FOUND`(`afterId`가 그 칸에 없을 때도), `404 GROUP_NOT_FOUND`

### ✅ `DELETE /shelf/items/{id}`
테이프 지우기(`itemDel`, "테이프를 지웠어요"). 파일도 지운다(보낸 사람도 못 듣기 때문에). 보낸 사람의 보낸 테이프 목록에는 남는다. `204`

---

## 12. share

링크 주소: `https://<도메인>/t/{token}` (유니버설 링크 / 앱 링크). 유효 기간 **7일**. 한 사람만 받을 수 있다.

### ✅ `GET /share/{token}`
앱에서 링크를 열었을 때. 소포 화면(`vParcel` + `viaLink` 칩)을 띄울 정보를 준다.
```json
{
  "state": "available",
  "deliveryId": null,
  "sender": { "userId": "…", "name": "하늘" },
  "tapeType": 1,
  "durationMs": 34000,
  "tag": "thinking",
  "sentAt": "…",
  "expiresAt": "…"
}
```
- `state: "claimed"`: **내가 이미 받은** 링크. `deliveryId`로 서랍의 그 테이프를 연다

| 오류 | 화면(`leOn`) |
|---|---|
| `409 LINK_TAKEN` | 이미 다른 분이 받은 테이프예요 |
| `410 LINK_EXPIRED` | 링크가 만료됐어요 |
| `409 LINK_OWN` (+`deliveryId`, `url`) | 내가 보낸 테이프예요 → 링크 다시 공유하기(`url` 그대로 공유) |
| `404 LINK_NOT_FOUND` | 찾을 수 없어요 |

### ✅ `POST /share/{token}/claim` 🔑
"뜯기"를 누르면 받는다. 한 트랜잭션에서 받는 사람을 채우고 테이프를 **"분류 안 함" 맨 위**에 넣고 **서로 친구**가 된다(어느 쪽이든 차단 관계면 친구는 맺지 않는다). 내가 이미 받았으면 같은 결과를 다시 준다.
```json
{ "item": ShelfItem, "friend": Friend | null }
```
→ 뜯기(`POST /deliveries/{id}/open`) → 재생 → "○○님과 친구가 되었어요"(`friend`가 있을 때). 오류는 위 표와 같다.

### ✅ `GET /share/{token}/web` @공개 · `POST /share/{token}/web/audio` @공개
앱이 없는 사람의 모바일 웹 페이지(`webOn`)용. 로그인 없이 부른다.
- `web` → `{ "senderName", "tapeType", "durationMs", "tag", "sentAt", "expiresAt" }`
- `web/audio` → `{ "url", "expiresAt", "durationMs" }` (10분)
- 웹에서 들어도 받은 것(claim)으로 치지 않는다. 오류: `LINK_TAKEN`, `LINK_EXPIRED`, `LINK_NOT_FOUND`

### ✅ `GET /t/{token}` @공개 (`/api` 밖, HTML)
모바일 웹 페이지: "○○님이 테이프를 보냈어요" → 소포 뜯기 → 웹 재생, 아래에 App Store / Google Play, "앱이 없어도 이 페이지에서 7일 동안 들을 수 있어요". 받은/만료된/없는 링크는 같은 톤의 안내 페이지(409/410/404).
`/.well-known/apple-app-site-association`(`/t/*`)과 `/.well-known/assetlinks.json`도 제공한다(환경 변수 `APPLE_APP_ID`, `ANDROID_PACKAGE_NAME`, `ANDROID_SHA256_FINGERPRINTS`가 없으면 404).

---

## 13. wallet

### ⏳ `GET /wallet`
```json
{ "credits": 120, "ads": { "rewardPerView": 10, "dailyLimit": 3, "remainingToday": 3 } }
```
하루 기준은 한국 시간(Asia/Seoul) 자정.

### ⏳ `GET /wallet/ledger?cursor=&limit=`
크레딧 내역(`histOn`). 최신이 앞. `{ "items": [LedgerEntry], "nextCursor": null }`

### ⏳ `POST /wallet/gifts` 🔑
친구 시트 > 선물(`shGift`).
```json
{ "toUserId": "…", "amount": 30 }
```
- `amount`: `10` · `30` · `50` · `100`만
- 한 트랜잭션에서 내 원장 `−30 "{상대}님에게 선물"`, 상대 원장 `+30 "{나}님이 선물"`, 상대에게 푸시

응답 `201 { "credits": 90, "entry": LedgerEntry }` → 토스트 "{이름}님에게 30 크레딧을 선물했어요"
오류 `402 INSUFFICIENT_CREDITS`(+`need`), `400 INVALID_GIFT_AMOUNT`, `404 FRIEND_NOT_FOUND`

---

## 14. shop

### ⏳ `GET /shop/products`
가격은 서버가 정한다(앱은 표시만).
```json
{
  "tapes": [
    { "id": "tape3_1", "tapeType": 3, "qty": 1, "name": "3분 테이프", "price": 30 },
    { "id": "tape3_5", "tapeType": 3, "qty": 5, "name": "3분 테이프 5개", "price": 120 },
    { "id": "tape5_1", "tapeType": 5, "qty": 1, "name": "5분 테이프", "price": 50 },
    { "id": "tape5_5", "tapeType": 5, "qty": 5, "name": "5분 테이프 5개", "price": 200 }
  ],
  "drawer": [ { "id": "drawer_10", "name": "서랍 넓히기", "slots": 10, "price": 100 } ],
  "creditPacks": [
    { "productId": "credits_100", "credits": 100, "priceLabel": "₩1,100" },
    { "productId": "credits_550", "credits": 550, "priceLabel": "₩5,500" },
    { "productId": "credits_1200", "credits": 1200, "priceLabel": "₩11,000" }
  ],
  "giftAmounts": [10, 30, 50, 100]
}
```
`creditPacks[].productId`는 App Store / Play Console의 상품 ID와 같다. 실제 표시 가격은 스토어 SDK 값을 우선한다.

### ⏳ `POST /shop/purchases` 🔑
구매 확인 시트(`shBuy`)의 "사기".
```json
{ "productId": "tape3_5" }
```
응답 `201`
```json
{ "credits": 0, "tapes": [ { "tapeType": 1, "qty": null }, { "tapeType": 3, "qty": 7 }, { "tapeType": 5, "qty": 0 } ], "drawer": { "stored": 11, "cap": 12, "full": false }, "entry": LedgerEntry }
```
토스트: 테이프 "보유 테이프에 넣었어요" / 서랍 "서랍에 10개 더 보관할 수 있어요".
오류 `402 INSUFFICIENT_CREDITS` + `need` → 충전 시트(`shCharge`, "N 크레딧이 더 필요해요"), `404 PRODUCT_NOT_FOUND`

---

## 15. billing

### ⏳ `POST /billing/iap` 🔑
스토어 결제가 끝나면(`shPay`) 영수증을 보낸다. 서버가 스토어에 검증하고 크레딧을 준다. 같은 거래를 두 번 보내도 한 번만 지급한다(`transactionId` UNIQUE).
```json
{ "store": "app_store", "productId": "credits_100", "transactionId": "2000000…", "verificationData": "JWS 또는 purchaseToken" }
```
- iOS: StoreKit 2 `jwsRepresentation` · Android: `purchaseToken`
- 응답 `200 { "credits": 220, "granted": 100, "entry": LedgerEntry }` → 앱은 스토어 거래를 `completePurchase`
- 오류 `400 RECEIPT_INVALID` → 결제 실패 시트(`shPayFail`), `409 RECEIPT_PENDING`
- 결제 취소는 스토어 SDK에서 끝난다(서버 호출 없음, 토스트만)

### ⏳ `GET /billing/admob/ssv` @공개
AdMob 보상형 광고 서버 측 확인(SSV) 콜백. Google 공개 키로 서명을 검증한 뒤 `custom_data`(= 사용자 id)에게 10 크레딧을 준다(하루 3회, `transaction_id` UNIQUE).
**앱 흐름**: 광고를 띄울 때 `ServerSideVerificationOptions(userId: me.id)`를 넣고 → 보상 콜백을 받으면 `GET /wallet`을 1초 간격으로 최대 5번 불러 크레딧이 늘었는지 확인한다(`remainingToday` 감소). 끝까지 안 보고 닫으면 보상이 없다("끝까지 봐야 받을 수 있어요"). 오늘 다 받았으면 광고를 띄우지 않는다(`remainingToday == 0` → "오늘은 다 받았어요").

### ⏳ `POST /billing/apple/notifications`, `POST /billing/google/rtdn` @공개
환불 알림. 환불된 충전만큼 크레딧을 회수한다(잔액이 모자라면 0까지, 원장 기록).

---

## 16. notifications

### ⏳ `PUT /notifications/devices`
로그인 후, 그리고 FCM 토큰이 바뀔 때마다. `{ "token": "FCM 토큰", "platform": "ios" }` → `204`

### ⏳ `DELETE /notifications/devices/{token}`
로그아웃 전에. `204`

### 푸시 모양 ⏳
`notificationsEnabled: false`면 보내지 않는다.
| 종류 | title | body | data |
|---|---|---|---|
| 테이프 도착 | `{보낸 사람}님이 테이프를 보냈어요` | `{3분} 테이프가 도착했어요. 뜯어서 들어보세요` | `{ "type": "tape", "deliveryId": "…" }` → 서랍 + 소포 화면 |
| 크레딧 선물 | `{보낸 사람}님이 크레딧을 선물했어요` | `{30} 크레딧을 받았어요` | `{ "type": "gift" }` → 크레딧 내역 |
| 링크 테이프를 받음 | `{이름}님이 테이프를 받았어요` | `이제 서로 친구예요` | `{ "type": "claimed", "deliveryId": "…" }` |

---

## 17. dev (개발 전용)

`NODE_ENV=production`이면 전부 `404`. 앱 개발과 e2e 테스트에서 2단계 기능(보내기·링크 받기) 없이 데이터를 만들 때 쓴다.

### ✅ `POST /dev/friends`
서로 친구 관계를 만든다(`lastAt`은 지금).
```json
{ "name": "지현", "starred": true }
```
또는 이미 있는 사용자(예: 다른 기기의 개발 계정)와:
```json
{ "userId": "…" }
```
`name`과 `userId` 중 하나만. 응답 `201 Friend`

프로토타입 초기 데이터 만들기 예: `POST /auth/dev {"key":"minkyung","name":"민경"}` → `POST /dev/friends`를 `지현(★)`, `엄마(★)`, `민수`, `하늘`, `박과장님`, `은비`로 6번.

---

## 18. 화면 → API 대응표 (디자인 v2)

| 화면 (템플릿 블록) | API |
|---|---|
| 스플래시 `splashOn` | `GET /app-version` → 미달이면 강제 업데이트 `updateOn`. 저장된 토큰이 있으면 `GET /users/me` |
| 온보딩 `auOnb` | 없음 |
| 로그인 `auLogin` | `POST /auth/kakao` · `POST /auth/apple` (개발: `POST /auth/dev`) |
| 이름 정하기 `auName` | `PATCH /users/me { name }` (`suggestedName`으로 미리 채움) |
| 마이크·알림 권한 `auMic` `auNoti` | 알림 허용 시 `PUT /notifications/devices` ⏳, 거부/나중에면 `PATCH /users/me { notificationsEnabled: false }` |
| 녹음 대기 `vIdle` | `GET /users/me` (`tapes` → 개수 알약, 0개면 상점으로) |
| 탭바 서랍 레드 점 `hasNew` | `GET /users/me` → `drawer.unopenedCount > 0` |
| 녹음 확인 `vConfirm` `convSlowOn` `convFailOn` | `POST /recordings` → PUT 업로드 → `POST /recordings/{id}/complete` → `GET /recordings/{id}` 1초 폴링 → 실패 시 `POST /recordings/{id}/retry` |
| 받는 사람 `vPick` | `GET /friends` |
| 라벨 `vLabel` · 포장 `vSending` · 발송 `vSent` · 실패 `sendFailOn` | `POST /deliveries` 🔑 |
| 서랍 `vShelf` `fullOn` `emptyOn` | `GET /shelf`, 칸 `POST/PATCH/DELETE /shelf/groups`, 드래그·옮기기 `PATCH /shelf/items/{id}`, 지우기 `DELETE /shelf/items/{id}` |
| 소포 뜯기 `vParcel` | `POST /deliveries/{id}/open` |
| 재생 `vPlay` `vLoadingOn` `vErrorOn` | `GET /deliveries/{id}/audio` |
| 새 테이프 푸시 `pushOn` | `GET /deliveries/{id}` |
| 친구 화면 `fvOn` | `GET /friends/{userId}/tapes` |
| 상점 `vShop` | `GET /shop/products`, `GET /wallet`, `GET /users/me` ⏳ |
| 구매 `shBuy` / 충전 `shCharge` | `POST /shop/purchases` 🔑 → `402 need` → 충전 시트 ⏳ |
| 결제 `shPay` `shPayFail` | 스토어 SDK → `POST /billing/iap` 🔑 ⏳ |
| 광고 `shAd` `shAdFail` | AdMob SDK(SSV) → `GET /wallet` 폴링 ⏳ |
| 선물 `shGift` · 선물 받음 푸시 | `POST /wallet/gifts` 🔑 ⏳ |
| 크레딧 내역 `histOn` | `GET /wallet/ledger` ⏳ |
| 마이 `vMy` | `GET /users/me`, `GET /friends`, `GET /deliveries/sent`, 이름 수정 `PATCH /users/me` |
| 친구 시트 `shFriend` | 즐겨찾기 `PATCH /friends/{id}`, 목록에서 빼기 `DELETE /friends/{id}`, 차단 `shBlock` → `POST /friends/{id}/block` |
| 보낸 테이프 상세 `shSentDetail` | `GET /deliveries/sent/{id}`, 링크 다시 공유하기 `POST /deliveries/sent/{id}/share` |
| 설정 > 알림 | `PATCH /users/me { notificationsEnabled }` |
| 설정 > 연결된 계정 | `GET /users/me` → `providers` |
| 설정 > 차단한 친구 `shBlocked` | `GET /friends/blocks`, 해제 `DELETE /friends/{id}/block` |
| 설정 > 로그아웃 | `DELETE /notifications/devices/{token}` ⏳ → `POST /auth/logout` |
| 설정 > 회원 탈퇴 `shWithdraw` | `DELETE /users/me` |
| 설정 > 앱 버전 | `GET /app-version` (`latestVersion`) |
| 링크 열기 `leOn`(taken/expired/own) · 앱에서 링크 `viaLink` | `GET /share/{token}` → `POST /share/{token}/claim` 🔑 |
| 모바일 웹 `webOn` | `GET /t/{token}`, `GET /share/{token}/web`, `POST /share/{token}/web/audio` |
| 오프라인 `offlineOn` · 서버 오류 `serverOn` | 네트워크 오류 / `5xx` |

---

## 19. 회원 탈퇴 데이터 정책

탈퇴 화면 경고("받은 테이프와 크레딧이 모두 사라진다")에 맞춘다. `DELETE /users/me`는 **즉시·영구 삭제**(유예 기간 없음)이고, 같은 소셜 계정으로 다시 로그인하면 새 계정으로 가입된다(가입 선물도 다시 받는다 — 악용되면 재가입 제한을 검토).

| 데이터 | 처리 | 상태 |
|---|---|---|
| 사용자(이름, 크레딧, 서랍 한도, 알림 설정) | 삭제 | ✅ |
| 로그인 계정(카카오·Apple 연결), refresh token | 삭제 → 모든 기기 즉시 로그아웃 | ✅ |
| 친구 관계 (내 목록, 상대 목록의 나) | 양쪽 모두 삭제 | ✅ |
| 차단 (내가 한 것, 나를 차단한 것) | 양쪽 모두 삭제 | ✅ |
| 크레딧 원장, 보유 테이프, 멱등 키 | 삭제 | ✅ |
| 받은 테이프(서랍, 칸)와 그 녹음 파일 | 삭제 | ✅ |
| 보낸 테이프 | **받은 사람의 서랍에는 남긴다**(받은 사람의 것). 보낸 사람은 `sender.userId: null` + 보낼 때 이름으로 보인다. 아직 아무도 안 받은 링크 테이프는 파일과 함께 삭제 | ✅ |
| 보내지 않은 녹음 | 파일과 함께 삭제 | ✅ |
| FCM 토큰 | 삭제 | ⏳ 3단계 |
| 결제 기록(`iap_purchases`) | 전자상거래법상 5년 보관: `user_id`만 NULL로 끊고 남긴다 | ⏳ 3단계 |
| Apple 로그인 | Apple 정책에 따라 토큰 철회(`/auth/revoke`) 필요 → 탈퇴 전에 앱이 authorization code를 받아 보내는 방식으로 추가 예정 | ⏳ |
| 카카오 로그인 | 카카오 연결 끊기(`/v1/user/unlink`, 어드민 키) | ⏳ |

---

## 20. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-09-25 | 1단계: 전체 계약 초안. app-version, auth(카카오·Apple·개발), users, friends(즐겨찾기·빼기·차단), dev 구현 |
| 2026-09-25 | 2단계: recordings, deliveries, shelf, share(+웹 페이지 `/t/{token}`, `.well-known`), 친구 테이프 구현. `Me.drawer.unopenedCount`·`GET /shelf`의 `unopenedCount` 추가(앱 요청). 변환 후 실제 길이로 `durationMs` 갱신 명시(앱 요청). `GET /friends`는 차단한 사람 제외 명시(앱 요청). `GET /share/{token}`에 `state`·`deliveryId`, 오류 코드 `TAPE_NOT_OPENED`·`UPLOAD_NOT_FOUND`·`RECORDING_TOO_LARGE` 추가. `PATCH /shelf/items`의 `groupId`·`afterId` 필수 |
