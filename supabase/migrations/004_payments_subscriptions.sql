-- 결제 기록
create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  order_id text not null unique,
  payment_key text,
  amount int not null default 9900,
  status text not null default 'pending',
  method text,
  created_at timestamptz default now()
);

alter table payments enable row level security;

create policy "Users can view own payments"
  on payments for select
  using (user_id = auth.uid());

-- 구독 관리
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) unique,
  billing_key text not null,
  status text not null default 'active',
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  created_at timestamptz default now()
);

alter table subscriptions enable row level security;

create policy "Users can view own subscription"
  on subscriptions for select
  using (user_id = auth.uid());
