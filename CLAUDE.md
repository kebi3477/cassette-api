# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

Cassette API. 목소리 테이프를 녹음해 친구에게 보내는 앱(`../cassette-app`, Flutter)의 백엔드.

- NestJS 12, ESM(`"type": "module"`), 테스트는 vitest, 린트는 oxlint
- Postgres(TypeORM, **마이그레이션으로 관리**, `synchronize` 사용 금지), Redis + BullMQ, MinIO(S3 호환)
- 미니PC에서 docker compose로 운영하고, Cloudflare Tunnel로 외부에 공개한다
- 두 저장소에 공통으로 적용되는 아키텍처 결정(스키마, 흐름, 미결정 사항)은 `../ARCHITECTURE.md`에 있다 (저장소 바깥 파일)
- 클라이언트는 Flutter 앱 하나다. 응답 스펙은 앱 도메인 모델과 맞춘다

## 폴더 구조 — Nest CLI 생성 구조

공식 문서와 Nest CLI가 만드는 구조를 따른다. 모듈은 손으로 만들지 않고 `nest g resource <이름>` 또는 `nest g module|controller|service`로 만든다.

```
src/
├── <기능>/
│   ├── <기능>.module.ts
│   ├── <기능>.controller.ts
│   ├── <기능>.service.ts
│   ├── dto/
│   └── entities/
├── common/                  # decorators/ guards/ filters/ interceptors/ pipes/
├── config/
├── app.module.ts
└── main.ts
test/                        # e2e
```

계획한 모듈은 다음과 같다: `auth` `users` `friends` `recordings`(+ `recordings.processor.ts`, ffmpeg 변환 워커) `deliveries` `shelf` `share` `wallet` `shop` `billing` `notifications`

## 서버가 강제하는 규칙

클라이언트를 믿지 않는다. 아래 규칙은 서버에서만 판정한다.

- 크레딧은 음수가 될 수 없다. 모든 증감은 `credit_ledger`에 기록하고, 차감은 `UPDATE ... WHERE credits >= :price` 같은 조건부 UPDATE로 한다
- 보내기·구매·선물은 `Idempotency-Key` 헤더로 중복 처리를 막는다
- 광고 보상(하루 3회, 1회 10 크레딧)은 AdMob SSV 콜백을 받을 때만 지급한다
- 결제는 스토어 영수증을 서버에서 검증하고, `transaction_id`는 UNIQUE로 둔다
- 3분·5분 테이프는 보낼 때 1개 차감한다. 1분은 무제한 무료다
- 다시 녹음은 무료 3회, 그 뒤로는 5 크레딧이다
- 녹음 파일은 받는 사람에게만, 짧은 만료의 presigned URL로 준다
- 가격과 수치는 디자인 원본(Claude Design 프로젝트 https://claude.ai/design/p/42baf543-407c-43b6-a96e-04d5997ef801 의 `design_handoff_cassette_app/source/CassetteApp.logic.js`)을 기준으로 한다

## 명령어

```bash
npm run start:dev
npm run build
npm run lint
npm test
npm run test:e2e
```

npm 10.9에는 이 템플릿의 peer 의존성을 풀다가 죽는 버그(`Cannot read properties of null (reading 'edgesOut')`)가 있다. 의존성을 새로 설치할 때는 `npx npm@11 install`을 쓴다.

## 커밋

- **커밋 메시지는 한 줄만 쓴다.** 본문이나 트레일러(Co-Authored-By 등)를 붙이지 않는다
- 접두어를 붙인다: `feat:` `fix:` `refactor:` `docs:` `test:` `chore:`
- 메시지 본문은 한국어로 쓴다. 예: `feat: 테이프 보내기 API(POST /deliveries) 추가`
