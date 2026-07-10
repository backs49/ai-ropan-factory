-- 005_billing_fixes.sql

-- 빌링키 발급에 사용된 Toss customerKey 저장 (갱신 결제에 필수)
alter table subscriptions add column customer_key text;

-- 생성 쿼터 원자적 소비: free 티어는 한도 체크와 증가를 단일 UPDATE로 수행
create or replace function consume_generation(p_user_id uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated int;
begin
  update profiles
  set monthly_generations = monthly_generations + 1
  where id = p_user_id
    and (tier <> 'free' or monthly_generations < p_limit);
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

-- 생성 실패 시 쿼터 환불
create or replace function refund_generation(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
  set monthly_generations = greatest(monthly_generations - 1, 0)
  where id = p_user_id;
end;
$$;

-- RPC는 service role 전용 (anon/authenticated 직접 호출 차단)
revoke execute on function consume_generation(uuid, int) from public, anon, authenticated;
revoke execute on function refund_generation(uuid) from public, anon, authenticated;
