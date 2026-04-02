# Episode Continuation (에피소드 이어쓰기) Design Spec

## Context

현재 시스템은 1화만 생성합니다. 사용자가 2화, 3화... episode_count까지 이어서 생성할 수 있어야 합니다.
이 기능 없이는 사용자가 Pro 결제를 할 동기가 없습니다.

## 요구사항

### 핵심 기능
- 프로젝트 상세 페이지에서 "다음 화 생성" 버튼 클릭으로 한 화씩 생성
- 생성 시 컨텍스트: 아웃라인 + 캐릭터 설정 + 직전 에피소드 마지막 ~1000자
- SSE 스트리밍으로 실시간 생성 표시
- 실패한 에피소드 재생성 가능

### 과금 정책
- **Free**: 프로젝트 최대 3개, 각 프로젝트 최대 3화
- **Pro**: 무제한
- 1화(초기 생성)는 기존 generation count에서 차감 (변경 없음)
- 2화부터는 에피소드 수 제한만 적용

## 설계

### 1. DB 스키마

```sql
-- 새 테이블: episodes
create table episodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  episode_number int not null,
  content text not null,
  status text not null default 'completed',  -- completed | generating | failed
  created_at timestamptz default now(),
  unique(project_id, episode_number)
);

-- RLS 정책
alter table episodes enable row level security;

create policy "Users can view own episodes"
  on episodes for select
  using (project_id in (select id from projects where user_id = auth.uid()));

create policy "Users can insert own episodes"
  on episodes for insert
  with check (project_id in (select id from projects where user_id = auth.uid()));

create policy "Users can update own episodes"
  on episodes for update
  using (project_id in (select id from projects where user_id = auth.uid()));

-- 데이터 마이그레이션: 기존 first_episode → episodes 테이블
insert into episodes (project_id, episode_number, content, status)
select id, 1, first_episode, 'completed'
from projects
where first_episode is not null;
```

기존 `projects.first_episode` 컬럼은 유지 (하위호환). 새 코드는 `episodes` 테이블만 참조.

### 2. API

#### `GET /api/generate/episode?projectId=...`

다음 화 생성 (SSE 스트리밍).

**흐름:**
1. 인증 + 프로젝트 소유권 확인
2. 무료 제한 체크: episodes 수 ≥ 3 && tier !== 'pro' → 403
3. 현재 최대 episode_number 조회 → nextNumber = max + 1
4. nextNumber > project.episode_count → "모든 에피소드가 완료되었습니다" 400
5. outline + characters + 직전 에피소드 마지막 ~1000자 조회
6. episodes row 삽입 (status: 'generating', content: '')
7. AI 스트리밍 생성
8. 완료 → content 업데이트, status = 'completed'
9. 실패 → status = 'failed'

#### `GET /api/generate/episode/retry?episodeId=...`

실패한 에피소드 재생성 (SSE 스트리밍).

**흐름:**
1. 인증 + 에피소드 소유권 확인
2. status !== 'failed' → 400
3. 직전 에피소드 컨텍스트 재구성
4. AI 스트리밍 재생성
5. 완료 → content + status 업데이트

### 3. 프롬프트

새 함수: `getNextEpisodePrompt(input, outline, characters, prevEpisodeEnd, episodeNumber, totalEpisodes)`

```
시스템: 당신은 한국 웹소설/로판 전문 작가입니다. 독자를 몰입시키는 매력적인 연재소설을 작성합니다.

사용자:
## 작품 정보
- 장르: {genre}
- 분위기: {mood}
- 타겟: {target_age}

## 아웃라인
{outline 요약}

## 캐릭터 설정
{characters JSON}

## 직전 에피소드 마지막 부분
{prevEpisodeEnd ~1000자}

## 요청
위 내용을 이어서 {episodeNumber}화를 작성해주세요.
전체 {totalEpisodes}화 중 {episodeNumber}화입니다.
- 약 3000~5000자 분량
- 직전 에피소드와 자연스럽게 연결
- 회차 끝에 다음 화가 궁금해지는 클리프행어 포함
- {episodeNumber}화가 마지막화라면 적절한 결말을 작성
```

### 4. UI

**프로젝트 상세 페이지 에피소드 탭 변경:**

기존 "1화" 탭 → "에피소드" 탭

```
[아웃라인] [캐릭터] [에피소드] [표지 & SEO]

[1화] [2화] [3화] [+ 다음 화 생성]
────────────────────────────────
(선택된 에피소드 본문)
```

**컴포넌트:**
- `EpisodeList` — 에피소드 서브탭 목록 + "다음 화 생성" 버튼
- 기존 `EpisodeView` — 에피소드 본문 표시 (재사용)
- `GenerateNextButton` — 다음 화 생성 버튼 (SSE 연결, 스트리밍 표시)

**상태별 표시:**
- `completed` — 본문 표시
- `generating` — 스트리밍 중 표시
- `failed` — "재생성" 버튼 표시

**무료 제한 도달 시:**
- "다음 화 생성" 버튼 대신 "Pro 업그레이드로 계속 생성하기" CTA

### 5. 수정 대상 파일

| 파일 | 변경 내용 |
|------|-----------|
| `supabase/migrations/003_episodes_table.sql` | 새 테이블 + RLS + 마이그레이션 |
| `types/index.ts` | Episode 타입 추가 |
| `lib/ai/prompts.ts` | `getNextEpisodePrompt()` 추가 |
| `app/api/generate/episode/route.ts` | 다음 화 생성 API (신규) |
| `app/api/generate/episode/retry/route.ts` | 에피소드 재생성 API (신규) |
| `lib/actions/episodes.ts` | getEpisodes, getEpisode 서버 액션 (신규) |
| `components/project/episode-list.tsx` | 에피소드 서브탭 + 다음화 버튼 (신규) |
| `components/project/generate-next-button.tsx` | 다음 화 생성 버튼 컴포넌트 (신규) |
| `app/(dashboard)/projects/[id]/page.tsx` | 에피소드 탭 UI 변경 |
| `app/api/generate/route.ts` | 1화를 episodes 테이블에도 저장 |

### 6. 하위호환

- 기존 `projects.first_episode`는 유지 (마이그레이션 후에도 삭제하지 않음)
- 기존 생성 파이프라인의 1화 생성 로직에서 episodes 테이블에도 삽입하도록 수정
- 마이그레이션 SQL이 기존 데이터를 episodes로 복사
