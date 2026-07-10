-- 007_cover_generation.sql

alter table projects add column cover_image_url text;
alter table profiles add column monthly_cover_count int not null default 0;
alter table profiles add column cover_reset_at timestamptz not null
  default (date_trunc('month', now()) + interval '1 month');

-- 표지 쿼터 원자 소비 (lazy 월간 리셋 포함, Pro 전용)
create or replace function consume_cover_generation(p_user_id uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated int;
begin
  -- 지난 달 카운터면 리셋
  update profiles
  set monthly_cover_count = 0,
      cover_reset_at = date_trunc('month', now()) + interval '1 month'
  where id = p_user_id and cover_reset_at <= now();

  update profiles
  set monthly_cover_count = monthly_cover_count + 1
  where id = p_user_id
    and tier in ('pro', 'enterprise')
    and monthly_cover_count < p_limit;
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

create or replace function refund_cover_generation(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
  set monthly_cover_count = greatest(monthly_cover_count - 1, 0)
  where id = p_user_id;
end;
$$;

revoke execute on function consume_cover_generation(uuid, int) from public, anon, authenticated;
revoke execute on function refund_cover_generation(uuid) from public, anon, authenticated;

-- 표지 이미지 공개 버킷 (쓰기는 service role만 — 별도 정책 없음)
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;
