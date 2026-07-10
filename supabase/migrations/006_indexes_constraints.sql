-- FK 인덱스 (Postgres는 FK에 자동 인덱스를 만들지 않음)
create index if not exists idx_episodes_project_id on episodes(project_id);
create index if not exists idx_payments_user_id on payments(user_id);
create index if not exists idx_subscriptions_renewal on subscriptions(status, current_period_end);

-- status 허용값 고정
alter table subscriptions add constraint subscriptions_status_check
  check (status in ('active', 'past_due', 'cancelled', 'failed', 'expired'));
alter table payments add constraint payments_status_check
  check (status in ('pending', 'paid', 'failed', 'cancelled'));

-- 결제 기록은 전자상거래법상 5년 보관 — 계정 삭제 시 연결만 해제(set null)
alter table payments alter column user_id drop not null;
alter table payments drop constraint payments_user_id_fkey;
alter table payments add constraint payments_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- 계정 삭제(auth.users 삭제) 시 구독 기록은 삭제되도록 cascade
alter table subscriptions drop constraint subscriptions_user_id_fkey;
alter table subscriptions add constraint subscriptions_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- 유저가 자기 에피소드를 삭제할 수 있도록 (기존에 DELETE 정책 없음)
create policy "Users can delete own episodes"
  on episodes for delete
  using (
    exists (
      select 1 from projects
      where projects.id = episodes.project_id
        and projects.user_id = auth.uid()
    )
  );
