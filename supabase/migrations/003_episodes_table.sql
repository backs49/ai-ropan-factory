-- episodes 테이블: 각 화를 별도 row로 저장
create table episodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  episode_number int not null,
  content text not null default '',
  status text not null default 'completed',
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

-- 기존 first_episode 데이터를 episodes로 마이그레이션
insert into episodes (project_id, episode_number, content, status)
select id, 1, first_episode, 'completed'
from projects
where first_episode is not null;
