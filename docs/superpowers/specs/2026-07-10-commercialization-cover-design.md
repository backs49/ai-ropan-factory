# 상용화 준비 + 표지 생성 기능 설계

날짜: 2026-07-10
상태: 승인됨

## 배경

AI 로판 팩토리(Next.js 16 + Supabase + Toss Payments)를 상용 서비스 수준으로 끌어올린다.
전체 감사 결과 결제/구독 시스템에 치명적 버그 다수, 프로덕션 필수 요소 부재가 확인됐다.
추가로 Pro 전용 표지 이미지 생성 기능을 도입한다.

## 확정된 정책 결정

| 항목 | 결정 |
|---|---|
| 작업 순서 | 결제/보안 → 프로덕션 필수 → 표지 기능 |
| 무료 생성 한도 | **평생 3회** (월간 리셋 없음 — UI 문구 통일) |
| 표지 기능 | **Pro 전용**, Gemini `gemini-2.5-flash-image` (~55원/장), 월 20회 한도 |
| 표지 텍스트 | 이미지에 텍스트 미포함 (한글 렌더링 불안정) — 제목은 UI 오버레이 |
| 모니터링(Sentry 등) | 이번 스코프 제외 |
| `first_episode` 레거시 이중 저장 | 이번 스코프 제외 (동작 문제 없음) |

---

## 1단계 — 결제/보안 크리티컬

### 1-1. customerKey 통일 (갱신 실패 근본 원인)

현재: 체크아웃 시 `crypto.randomUUID()`로 생성, 어디에도 저장 안 됨. 크론 갱신은
`user_id`로 결제 시도 → Toss가 거부 → 모든 Pro 유저가 첫 달 후 자동 강등.

수정:
- `components/pricing/toss-checkout.tsx`: `customerKey`를 `user.id`로 고정 (서버에서 prop 전달)
- 마이그레이션 005: `subscriptions.customer_key text` 추가
- `app/api/payments/billing-key/success/route.ts`: customer_key 저장
- `app/api/cron/billing/route.ts`: `sub.customer_key ?? sub.user_id` 사용 (기존 구독 호환)

### 1-2. 결제 성공 라우트 견고화 (`billing-key/success/route.ts`)

- `redirect()`를 try 블록 밖으로 — 현재는 `NEXT_REDIRECT` 예외가 catch에 먹혀
  모든 에러가 generic `processing_failed`로 뭉개짐
- 결제 후 DB 쓰기 3건(payments/subscriptions/profiles) 각각 `.error` 체크,
  실패 시 에러 로그 + 유저에게 "결제 완료, 반영 지연" 안내 리다이렉트
- Toss API 호출에 `Idempotency-Key` 헤더, `orderId`는 UUID 기반으로
- 이미 active 구독이 있으면 중복 결제 차단 (사전 체크 후 pricing으로 리다이렉트)
- 실패한 첫 결제도 `payments`에 `status='failed'`로 기록

### 1-3. 크론 견고화 (`cron/billing/route.ts`)

- `CRON_SECRET` 미설정 시 무조건 401 (현재: 미설정이면 전면 공개)
- 갱신 기간: `기존 current_period_end + 1개월` 기준 (드리프트/월말 롤오버 방지)
- 결제 실패 시: 즉시 강등 대신 `past_due` 상태 전환, **3일 유예 + 일일 재시도**,
  유예 초과 시 `failed` + tier 강등. 네트워크 예외도 동일 경로로 일원화
- cancelled 만료 강등 후 `status='expired'` 마킹 (현재: 매일 무한 재처리)
- 갱신 결제에 `Idempotency-Key` (부분 실패 후 재실행 시 이중 청구 방지)
- 처리 대상 쿼리에 limit(예: 100) — 함수 타임아웃 방지

### 1-4. 결제 결과 유저 표시

- `pricing/page.tsx`: `searchParams.error` 읽어 에러 코드별 한국어 배너
- 대시보드: `?upgraded=true` 시 Pro 전환 축하 배너

### 1-5. 쿼터 원자화 + 정책 정리

- 마이그레이션 005에 RPC `consume_generation(p_user_id, p_limit)`:
  `UPDATE ... SET monthly_generations = monthly_generations + 1
   WHERE id = $1 AND (tier != 'free' OR monthly_generations < $2)` 단일 쿼리로
  체크+증가 원자화. `app/api/generate/route.ts`에서 생성 시작 전 호출,
  실패 시 한도 초과 SSE 에러
- "평생 3회" 확정: settings/dashboard UI 문구 통일, `monthly_reset_at`은 미사용으로 문서화
- 프로젝트 3개 카운트에서 `status='failed'` 제외 (실패작이 슬롯 차지 방지)
- 에피소드 생성 라우트에도 free 한도 재확인 유지 + 프로젝트 상태 가드 추가

### 1-6. 서버 입력 검증 (`lib/actions/generation.ts`)

- `genre`/`mood`/`target_age`: 허용 목록 검증 (types의 상수 기준)
- `episode_count`: 10~200 clamp
- `keywords`: 최대 10개, 각 30자 제한
- `title` 등 문자열 길이 제한

### 1-7. Toss 웹훅 스텁 삭제

`app/api/webhooks/toss/route.ts` — 무인증 공개 POST + 결제 페이로드 콘솔 로깅 상태.
미구현이므로 삭제 (추후 필요 시 서명 검증 포함해 제대로 구현).

---

## 2단계 — 프로덕션 필수

### 2-1. 에러/로딩 UI
- `app/error.tsx`, `app/not-found.tsx`, `app/global-error.tsx`
- `app/(dashboard)/loading.tsx` (스켈레톤)

### 2-2. SSE 에러 처리
- `generation-stream.tsx`, `generate-next-button.tsx`, `retry-button.tsx`:
  `onerror` 시 에러 상태 UI + 재시도 버튼 (현재: 조용히 멈춤)
- 모든 `JSON.parse(event.data)`에 try/catch 가드

### 2-3. 고착 generating 복구
- 프로젝트 페이지: `status='generating'`이고 `updated_at`이 10분 경과면
  "생성이 중단된 것 같습니다" + 다시 시도 버튼 (failed로 전환 후 retry 흐름 재사용)

### 2-4. 비밀번호 재설정
- `/forgot-password` (메일 발송), `/reset-password` (새 비밀번호) 페이지
- Supabase `resetPasswordForEmail` + `updateUser`

### 2-5. 이메일 확인 대응
- 가입 후 세션이 없으면(이메일 확인 활성화 환경) "메일함을 확인하세요" 안내 화면

### 2-6. 계정 삭제
- 설정 페이지에 탈퇴 섹션 (확인 문구 입력 → server action)
- service client `auth.admin.deleteUser` — FK cascade로 데이터 정리
- active 구독이 있으면 먼저 해지 안내

### 2-7. 약관/개인정보처리방침
- `/terms`, `/privacy` 정적 페이지 (한국 전자상거래/개인정보보호법 기본 구성)
- 랜딩 푸터 + 가입 폼에 링크

### 2-8. 코드 정리
- `lib/claude/` 디렉터리 삭제 (죽은 코드)
- `extractJSON` 중복 제거 — `lib/ai/pipeline.ts`에서 export, retry 라우트가 import
- `generate/episode/route.ts`·`episode/retry/route.ts`의 무의미한 삼항(`heavy : heavy`) 수정

### 2-9. DB 마이그레이션 006
- 인덱스: `episodes(project_id)`, `payments(user_id)`, `subscriptions(status, current_period_end)`
- CHECK 제약: `subscriptions.status`, `payments.status` 허용값 고정
- `episodes` DELETE 정책 추가

### 2-10. SEO 기본
- 랜딩/주요 페이지 metadata + OG 태그, `app/robots.ts`

---

## 3단계 — 표지 생성 (Pro 전용)

### 데이터 (마이그레이션 007)
- `projects.cover_image_url text`
- `profiles.monthly_cover_count int default 0`, `profiles.cover_reset_at timestamptz`
  — 사용 시점에 지난 달이면 리셋(lazy), 별도 크론 불필요
- RPC `consume_cover_generation(p_user_id, p_limit)` — 쿼터 원자 소비 (한도 20/월)
- Supabase Storage `covers` 버킷 (public read, 서버만 쓰기)

### API — `POST /api/generate/cover`
1. 인증 → 프로젝트 소유 확인 → `tier='pro'` 확인 (아니면 403 + 업그레이드 안내)
2. lazy 리셋 + RPC로 월 20회 원자 체크
3. 프롬프트 구성: 제목/장르/분위기/줄거리 요약/주인공 외형(characters JSON에서 추출)
   — "세로 2:3 로맨스 판타지 웹소설 표지 일러스트, 텍스트 없음" 스타일 고정
4. Gemini `gemini-2.5-flash-image` 호출 (기존 `GEMINI_API_KEY`)
5. 결과 이미지를 Storage `covers/{projectId}.png` 업로드(upsert) → `cover_image_url` 갱신
6. JSON 응답 (스트리밍 불필요 — 단일 이미지)

### UI
- 프로젝트 상세: 표지 카드 — Pro면 생성/재생성 버튼 + 로딩 상태 + 제목 오버레이,
  Free면 잠금 카드 + `/pricing` 링크
- 대시보드 프로젝트 카드: 표지 썸네일 (없으면 기존 레이아웃 유지)
- 실패 시 에러 메시지 + 재시도. 쿼터는 원자적 선소비 후 실패 시 환불 —
  동시 요청 이중 소비를 막으면서 이미지 API 실패로 쿼터를 잃지 않게
  (텍스트 생성 쿼터와 동일 패턴)

---

## 검증

테스트 프레임워크 없음 — 각 단계마다:
- `npm run build` + `npm run lint`
- 핵심 플로우 수동 확인 (dev 서버)
- 결제 변경분은 Toss 테스트 키로 체크아웃→성공 리다이렉트→구독 레코드 확인
- 크론은 로컬에서 `curl -H "Authorization: Bearer $CRON_SECRET"` 호출로 검증

## 단계별 커밋

각 단계(1/2/3)를 독립 커밋 묶음으로 진행 — 문제가 생기면 단계 단위로 되돌릴 수 있게.
