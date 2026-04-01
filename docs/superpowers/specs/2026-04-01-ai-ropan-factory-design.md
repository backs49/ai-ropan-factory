# AI 로판 팩토리 - 설계 문서

## 개요

AI 웹소설/로판 자동 기획 & 챕터 생성 SaaS. 초보 작가부터 현직 작가까지 사용 가능한 웹소설 기획 도구.

- **목표**: 이번 달 내 크몽 + SaaS 런칭
- **스택**: Next.js 15 App Router + Supabase + Anthropic Claude API
- **UI**: TypeScript, Tailwind CSS, shadcn/ui, 다크모드 기본, 모바일 반응형

## 타겟 사용자

- 웹소설 작가 지망생 (아이디어 구조화 도구)
- 현직 웹소설 작가 (생산성 향상)
- 생성 콘텐츠 → 카카오페이지/네이버 시리즈 투고 목적

## 아키텍처

```
[브라우저] ←SSE 스트리밍→ [Next.js 15 Route Handler /api/generate]
                                    ↓
                        [Anthropic Claude API] (4단계 순차 호출)
                                    ↓
                        [Supabase PostgreSQL + Auth + RLS]
```

- Server Actions: 폼 제출, DB CRUD
- Route Handler (`/api/generate`): Claude API 4단계 순차 호출 + SSE 스트리밍
- Node.js Runtime (maxDuration: 300초) — Edge 타임아웃 회피

## 과금 모델

| 티어 | 월 생성 횟수 | 가격 |
|------|-------------|------|
| Free | 3회 | 무료 |
| Pro | 무제한 | 유료 (Toss Payments) |
| Enterprise | 무제한 + 팀 기능 | 추후 |

## DB 스키마

### profiles

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | auth.users.id 참조 |
| email | TEXT | 이메일 |
| display_name | TEXT | 표시 이름 |
| tier | ENUM('free','pro','enterprise') | 기본 'free' |
| monthly_generations | INT | 이번 달 생성 횟수, 기본 0 |
| monthly_reset_at | TIMESTAMPTZ | 월 리셋 시점 |
| created_at | TIMESTAMPTZ | 생성일 |
| updated_at | TIMESTAMPTZ | 수정일 |

### projects

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | 프로젝트 ID |
| user_id | UUID FK | profiles.id 참조 |
| title | TEXT | 프로젝트 제목 |
| status | ENUM | 'generating','completed','failed','archived' |
| genre | TEXT | 로판/빙의/환생/실버로맨스 등 |
| keywords | TEXT[] | 최대 5개 |
| target_age | TEXT | 10대/20대/30대+ |
| mood | TEXT | 사이다/집착/치유/다크 |
| episode_count | INT | 원하는 화수 |
| outline | JSONB | 3막 구조 + 50화 아웃라인 |
| characters | JSONB | 캐릭터 8명 시트 |
| first_episode | TEXT | 1화 완성본 (4,000~5,000자) |
| cover_prompts | JSONB | Midjourney/Flux 표지 프롬프트 3개 |
| seo | JSONB | 제목 5개 + 해시태그 |
| variation_of | UUID FK NULL | 다시 생성 원본 프로젝트 |
| token_usage | JSONB | {input_tokens, output_tokens, cost_estimate} |
| created_at | TIMESTAMPTZ | 생성일 |
| updated_at | TIMESTAMPTZ | 수정일 |

### RLS 정책

모든 테이블: `user_id = auth.uid()` 조건으로 본인 데이터만 CRUD 가능.

## 페이지 구조

```
app/
  (auth)/login/page.tsx        — 로그인
  (auth)/signup/page.tsx       — 회원가입
  (dashboard)/layout.tsx       — 인증 필수 레이아웃 + 사이드바
  (dashboard)/page.tsx         — 대시보드 (생성 기록)
  (dashboard)/generate/page.tsx — 생성 폼
  (dashboard)/projects/[id]/page.tsx — 결과 상세
  (dashboard)/settings/page.tsx — 계정 설정
  api/generate/route.ts        — SSE 스트리밍
  api/webhooks/toss/route.ts   — Toss Payments 웹훅 placeholder
  layout.tsx                   — 루트 레이아웃
  page.tsx                     — 랜딩 페이지
```

## 생성 파이프라인 (4단계)

| 단계 | 입력 | 출력 | 예상 토큰 |
|------|------|------|-----------|
| 1. 구조 | 장르+키워드+분위기+화수 | 3막 구조 + 50화 아웃라인 (JSON) | ~4,000 |
| 2. 캐릭터 | 1단계 결과 + 입력 | 8명 상세 시트 (JSON) | ~3,000 |
| 3. 1화 | 1+2단계 결과 | 4,000~5,000자 한국어 소설 | ~5,000 |
| 4. 메타 | 1+2단계 결과 | 표지 프롬프트 3개 + SEO 제목 5개 + 해시태그 | ~1,500 |

각 단계 완료 시 DB에 즉시 저장. 중간 실패 시 이전 단계 결과 보존.

## 컴포넌트 구조

```
components/
  ui/                     — shadcn/ui
  auth/login-form.tsx, signup-form.tsx
  dashboard/project-card.tsx, project-list.tsx
  generate/generation-form.tsx, generation-stream.tsx, stage-card.tsx
  project/outline-view.tsx, character-sheet.tsx, episode-view.tsx, download-button.tsx
  layout/sidebar.tsx, header.tsx, theme-provider.tsx
```

## 콘텐츠 소유권

- MVP: 개인 전용. 본인만 열람, TXT/MD 다운로드 지원.
- UI에 "생성된 모든 콘텐츠의 저작권은 사용자에게 100% 귀속됩니다" 표시.
- v2: 링크 공유 + 공개/비공개 설정 추가 예정.

## 보안

- API 키: 환경변수 (ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY)
- Rate limit: 티어별 월간 생성 횟수 제한
- RLS: 모든 테이블에 사용자별 접근 제어
- 토큰 사용량: projects.token_usage에 추적

## 결제 (placeholder)

- Toss Payments 웹훅 엔드포인트 준비
- 결제 완료 시 profiles.tier를 'pro'로 업데이트
- 실제 연동은 MVP 이후
