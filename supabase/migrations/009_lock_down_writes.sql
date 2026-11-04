-- 009_lock_down_writes.sql
-- 사용자(authenticated)가 공개 키로 직접 쓸 수 있는 컬럼을 최소화한다.
-- 기존에는 RLS가 "자기 행"만 확인하고 컬럼은 제한하지 않아, 브라우저에서
-- profiles.tier = 'pro' 로 바꾸거나 episodes.status = 'failed' 로 바꿔
-- 무료 재생성을 반복하는 우회가 가능했다. 상태·쿼터 컬럼 쓰기는 이제 service role 전용.

-- ---------------------------------------------------------------------------
-- 1) 컬럼 단위 쓰기 권한
-- ---------------------------------------------------------------------------

-- profiles: 사용자는 표시 이름과 AI 프로바이더만 변경 가능
revoke insert, update on profiles from anon, authenticated;
grant update (display_name, ai_provider) on profiles to authenticated;

-- projects: 생성 입력값만 insert 가능 (status/outline 등은 기본값·서버가 채움), update 불가
revoke insert, update on projects from anon, authenticated;
grant insert (user_id, genre, keywords, target_age, mood, episode_count, variation_of)
  on projects to authenticated;

-- episodes: 사용자는 본문(content) 편집만 가능, insert 불가
revoke insert, update on episodes from anon, authenticated;
grant update (content) on episodes to authenticated;

-- 서버 액션 검증(10~200화)을 DB에서도 강제. 기존 행은 검사하지 않음(not valid)
alter table projects add constraint projects_episode_count_check
  check (episode_count between 10 and 200) not valid;

-- ---------------------------------------------------------------------------
-- 2) 재시도 횟수 제한 컬럼
-- ---------------------------------------------------------------------------
alter table projects add column retry_count int not null default 0;
alter table projects add column retry_started_at timestamptz;
alter table episodes add column retry_count int not null default 0;

-- 프로젝트 누락 단계 재시도 클레임: 동시 실행 차단 + 횟수 제한
-- (진행 중 클레임은 10분 후 만료 — 서버가 중단돼 해제되지 못한 경우 대비)
create or replace function claim_project_retry(p_project_id uuid, p_user_id uuid, p_max int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated int;
begin
  update projects
  set retry_count = retry_count + 1,
      retry_started_at = now()
  where id = p_project_id
    and user_id = p_user_id
    and status = 'completed'
    and retry_count < p_max
    and (retry_started_at is null or retry_started_at < now() - interval '10 minutes');
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

-- 실패 에피소드 재생성 클레임: failed → generating 원자 전환 + 횟수 제한
create or replace function claim_episode_retry(p_episode_id uuid, p_max int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated int;
begin
  update episodes
  set status = 'generating',
      content = '',
      retry_count = retry_count + 1
  where id = p_episode_id
    and status = 'failed'
    and retry_count < p_max;
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) 에피소드 월간 쿼터 (모든 티어 — 한도는 호출 측에서 티어별로 전달)
-- ---------------------------------------------------------------------------
alter table profiles add column monthly_episode_count int not null default 0;
alter table profiles add column episode_reset_at timestamptz not null
  default (date_trunc('month', now()) + interval '1 month');

create or replace function consume_episode_generation(p_user_id uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated int;
begin
  -- 지난 달 카운터면 리셋 (lazy)
  update profiles
  set monthly_episode_count = 0,
      episode_reset_at = date_trunc('month', now()) + interval '1 month'
  where id = p_user_id and episode_reset_at <= now();

  update profiles
  set monthly_episode_count = monthly_episode_count + 1
  where id = p_user_id
    and monthly_episode_count < p_limit;
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

create or replace function refund_episode_generation(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
  set monthly_episode_count = greatest(monthly_episode_count - 1, 0)
  where id = p_user_id;
end;
$$;

revoke execute on function claim_project_retry(uuid, uuid, int) from public, anon, authenticated;
revoke execute on function claim_episode_retry(uuid, int) from public, anon, authenticated;
revoke execute on function consume_episode_generation(uuid, int) from public, anon, authenticated;
revoke execute on function refund_episode_generation(uuid) from public, anon, authenticated;
