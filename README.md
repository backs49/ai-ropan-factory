# AI 로판 팩토리 (AI Ropan Factory)

장르·키워드만 입력하면 AI가 웹소설(로맨스 판타지) 한 편을 **기획부터 연재까지** 만들어주는 SaaS입니다. 3막 아웃라인 → 캐릭터 시트 → 1화 완성본 → SEO/표지 프롬프트를 실시간 스트리밍으로 생성하고, 버튼 하나로 다음 화를 이어서 연재합니다.

Next.js 16 App Router + Supabase + 멀티 AI 프로바이더(Claude / Gemini / Grok) 스트리밍 아키텍처로 구현했으며, 토스페이먼츠 빌링키 정기결제 기반의 Free/Pro 구독 모델을 갖춘 상용 수준 프로젝트입니다.

---

## 주요 기능

### AI 생성 파이프라인
- **4단계 자동 생성** — 아웃라인 → 캐릭터 → 1화 → 메타(SEO·표지 프롬프트)를 순차 실행 (`lib/ai/pipeline.ts`)
- **3막 구조 아웃라인** — 로그라인, 막별 요약, 에피소드별 제목/요약/핵심 사건까지 설계
- **캐릭터 시트** — 외모, 성격, 비밀, 동기, 인물 관계도를 포함한 상세 설정
- **에피소드 연재** — 직전 화의 마지막 부분 + 아웃라인 + 캐릭터를 컨텍스트로 다음 화 생성. 마지막 화면 결말을, 아니면 클리프행어를 쓰도록 프롬프트가 분기 (`lib/ai/prompts.ts`)
- **메타 생성** — SEO 제목/해시태그/소개문 + Midjourney/Flux용 표지 프롬프트(스타일·네거티브 프롬프트 포함)
- **AI 표지 이미지 생성** (Pro 전용) — Gemini `gemini-2.5-flash-image`로 2:3 세로 표지 생성 후 Supabase Storage에 업로드, 월 20회 한도

### 멀티 AI 프로바이더
- 사용자가 설정에서 **Claude(Anthropic) / Gemini(Google) / Grok(xAI)** 중 선택
- `streamAI()` 단일 인터페이스로 3사 SDK의 서로 다른 스트리밍 방식을 통합 (`lib/ai/providers.ts`)
- **티어 기반 모델 라우팅** — Free는 아웃라인/캐릭터/메타에 경량 모델, 1화에만 상위 모델. Pro는 전 단계 상위 모델
- 프로바이더별 JSON 응답 모드(`expectsJSON`) 지원 + 코드블록/설명 텍스트에 감싸인 JSON을 안전하게 파싱하는 `extractJSON()`

### 실시간 스트리밍 UX
- 모든 생성 API는 `ReadableStream` + `text/event-stream`(SSE), 클라이언트는 `EventSource`로 소비
- 단계별 진행 카드(시작/스트리밍/완료/실패)로 생성 과정을 실시간 표시
- 생성이 중단돼 멈춘 프로젝트를 감지해 **복구(상태 초기화 + 쿼터 환불)** 하는 stuck recovery

### 구독 결제 (토스페이먼츠)
- 빌링키 발급 → 정기결제 흐름. Pro 월 9,900원, Free는 프로젝트 3개 · 생성 3회 · 프로젝트당 3화 한도
- **구독 상태 머신** — `active` → 결제 실패 시 `past_due`(3일 유예, 크론이 매일 재시도) → 유예 만료 시 다운그레이드. 해지 구독은 기간 종료 후 `expired`
- **일일 갱신 크론** (`/api/cron/billing`, Vercel Cron 매일 09:00 UTC) — `CRON_SECRET` 미설정 시 무조건 401, 결정적 멱등키로 재시도 시 이중 청구 방지

### 동시성·쿼터 안전장치
- **원자적 쿼터 소비** — 한도 검사와 증가를 단일 `UPDATE`로 처리하는 `security definer` RPC(`consume_generation` / `refund_generation`)로 race condition에 의한 이중 소비 차단, 실패 시 환불 RPC
- **생성 클레임** — `generation_started_at` 마커를 원자적으로 선점해 새로고침/동시 요청에 의한 중복 파이프라인 실행 차단
- **컬럼 단위 쓰기 권한** — 사용자는 공개 키로 표시 이름·AI 프로바이더·에피소드 본문만 수정 가능. 등급·쿼터·생성 상태 컬럼은 service role 전용 (마이그레이션 009)
- **재시도·연재 상한** — 에피소드 재생성은 화당 3회, 누락 단계 재시도는 프로젝트당 3회, 에피소드 생성은 월간 상한(Pro 100화)을 원자적 RPC로 관리
- 서버 액션에서 장르/분위기/연령대 화이트리스트 검증, 화수 10–200 클램프, 키워드 개수/길이 제한

### 그 외
- Supabase 이메일/비밀번호 인증 + 비밀번호 재설정 플로우 (Host 헤더 대신 `NEXT_PUBLIC_SITE_URL` 사용으로 스푸핑 방지)
- 회원 탈퇴 (활성 구독 존재 시 차단)
- 에피소드 인라인 편집, 클립보드 복사, **Markdown/TXT 다운로드**
- 이용약관/개인정보처리방침, 에러/404/로딩 페이지, robots.txt, OG 메타데이터

---

## 동작 방식

```
사용자 입력 (장르 · 키워드 · 분위기 · 연령대 · 화수)
        │
        ▼
프로젝트 생성 (서버 액션, 입력 검증 + 무료 한도 체크)
        │
        ▼
GET /api/generate?projectId=...   ← EventSource(SSE)로 구독
        │
        ├─ ① 생성 클레임 (원자적 선점 — 중복 실행 차단)
        ├─ ② 쿼터 선소비 (consume_generation RPC — 실패 시 환불)
        │
        ▼
runGenerationPipeline()  ── streamAI() ──▶  Claude / Gemini / Grok
        │
        ├─ Stage 1  아웃라인   (3막 구조, JSON)
        ├─ Stage 2  캐릭터     (인물 시트 배열, JSON)
        ├─ Stage 3  1화 완성본 (순수 텍스트, 3,000~5,000자)
        └─ Stage 4  메타       (SEO + 표지 프롬프트, JSON)
        │
        ▼
Supabase 저장 (projects / episodes) + 토큰 사용량·비용 추정 기록
        │
        ▼
"다음 화 생성" → /api/generate/episode  (직전 화 끝부분을 컨텍스트로 연재)
```

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router, Turbopack), React 19, TypeScript 5 |
| AI — Anthropic | `@anthropic-ai/sdk` — Claude Haiku 5.5 (경량) / Sonnet 5.5 (상위) |
| AI — Google | `@google/genai` — Gemini 3.8 Flash (경량) / Gemini 3.1 Pro (상위), `gemini-2.5-flash-image` (표지) |
| AI — xAI | `openai` SDK + `api.x.ai` baseURL — Grok 4.7 (경량·상위 공통) |
| DB / 인증 / 스토리지 | Supabase (PostgreSQL + RLS, Auth, Storage) — `@supabase/ssr`, `@supabase/supabase-js` |
| 결제 | 토스페이먼츠 빌링키 API (v2 standard, CDN 스크립트 동적 로드) |
| UI | Tailwind CSS v4, shadcn/ui (Base UI 변형), lucide-react, sonner, next-themes |
| 배포 | Vercel (Cron 포함) |

---

## 프로젝트 구조

```
app/
├── (auth)/              # 로그인, 회원가입, 비밀번호 찾기/재설정, 이메일 확인
├── (dashboard)/         # 대시보드, 생성, 프로젝트 상세, 요금제, 설정 (인증 필요)
├── api/
│   ├── generate/        # SSE 생성 파이프라인 + 재시도
│   │   ├── episode/     # 다음 화 생성 + 재시도
│   │   └── cover/       # AI 표지 생성 (Pro)
│   ├── payments/        # 토스 빌링키 발급 성공/실패, 구독 해지
│   └── cron/billing/    # 일일 구독 갱신 크론
├── privacy/ · terms/    # 개인정보처리방침 · 이용약관
components/
├── generate/            # 생성 폼, SSE 스트림 뷰, 단계 카드
├── project/             # 아웃라인/캐릭터/에피소드 뷰, 표지 카드, 다운로드, 복구
├── pricing/             # 요금제 카드, 토스 체크아웃
├── settings/            # AI 프로바이더 선택, 구독 관리, 회원 탈퇴
└── ui/                  # shadcn/ui 컴포넌트
lib/
├── ai/                  # providers(멀티 AI 통합) · pipeline(4단계) · prompts · cover
├── actions/             # 서버 액션 (프로젝트, 에피소드, 인증, 계정, 설정)
└── supabase/            # 서버/클라이언트/미들웨어 클라이언트
supabase/migrations/     # 001~009 (스키마, 에피소드, 결제/구독, 쿼터 RPC, 표지, 생성 클레임, 쓰기 권한 잠금)
types/index.ts           # 도메인 타입 + AI 모델 매핑 + 티어 한도
```

---

## 시작하기

### 1. 설치

```bash
git clone https://github.com/backs49/ai-ropan-factory.git
cd ai-ropan-factory
npm install
```

### 2. 환경변수

`.env.local.example`을 `.env.local`로 복사한 뒤 값을 채웁니다.

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 키 (크론·쿼터 RPC 등 RLS 우회 쓰기) |
| `ANTHROPIC_API_KEY` | Claude API 키 |
| `GEMINI_API_KEY` | Gemini API 키 (표지 생성은 이 키가 필수) |
| `XAI_API_KEY` | Grok API 키 |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | 토스페이먼츠 클라이언트 키 (API 개별 연동 키) |
| `TOSS_SECRET_KEY` | 토스페이먼츠 시크릿 키 (서버 전용) |
| `CRON_SECRET` | 갱신 크론 인증 (미설정 시 크론이 항상 401) |
| `NEXT_PUBLIC_APP_URL` | 앱 URL (로컬: `http://localhost:3000`) |
| `NEXT_PUBLIC_SITE_URL` | 배포 도메인 (비밀번호 재설정 링크 등에 사용) |

AI 키는 사용할 프로바이더 것만 있어도 동작합니다 (기본 프로바이더는 Gemini).

모델 ID는 선택적으로 `AI_MODEL_{GEMINI|GROK|ANTHROPIC}_{LIGHT|HEAVY}` 환경변수로 덮어쓸 수 있습니다. 모델이 은퇴했을 때 재배포 없이 교체할 수 있습니다.

### 3. 데이터베이스

Supabase SQL Editor에서 `supabase/migrations/`의 SQL을 **001부터 009까지 순서대로** 실행합니다. 프로필 자동 생성 트리거, RLS 정책, 쿼터 RPC, `covers` 스토리지 버킷이 함께 세팅됩니다.

### 4. 실행

```bash
npm run dev     # 개발 서버 (http://localhost:3000)
npm run build   # 프로덕션 빌드
npm run lint    # ESLint
```

---

## 테스트

별도의 테스트 프레임워크는 구성되어 있지 않습니다. `npm run lint`로 정적 검사를 수행합니다.

---

## 라이선스

포트폴리오 열람 목적으로 공개. 무단 사용 및 상업적 이용 금지. © 2026 Mangu Kwon. All rights reserved.
