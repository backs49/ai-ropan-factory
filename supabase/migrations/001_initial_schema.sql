-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Tier enum
create type user_tier as enum ('free', 'pro', 'enterprise');

-- Project status enum
create type project_status as enum ('generating', 'completed', 'failed', 'archived');

-- Profiles table
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  tier user_tier not null default 'free',
  monthly_generations int not null default 0,
  monthly_reset_at timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Projects table
create table projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text,
  status project_status not null default 'generating',
  genre text not null,
  keywords text[] not null default '{}',
  target_age text not null,
  mood text not null,
  episode_count int not null default 50,
  outline jsonb,
  characters jsonb,
  first_episode text,
  cover_prompts jsonb,
  seo jsonb,
  variation_of uuid references projects(id) on delete set null,
  token_usage jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index idx_projects_user_id on projects(user_id);
create index idx_projects_status on projects(status);
create index idx_projects_created_at on projects(created_at desc);

-- RLS: Enable
alter table profiles enable row level security;
alter table projects enable row level security;

-- RLS: Profiles - users can only read/update their own profile
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- RLS: Projects - users can only CRUD their own projects
create policy "Users can view own projects"
  on projects for select
  using (auth.uid() = user_id);

create policy "Users can insert own projects"
  on projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update own projects"
  on projects for update
  using (auth.uid() = user_id);

create policy "Users can delete own projects"
  on projects for delete
  using (auth.uid() = user_id);

-- Function: Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger: Auto-create profile
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function: Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure public.update_updated_at();

create trigger projects_updated_at
  before update on projects
  for each row execute procedure public.update_updated_at();

-- Service role policy for API route to update projects
create policy "Service role can manage all projects"
  on projects for all
  using (auth.role() = 'service_role');

create policy "Service role can manage all profiles"
  on profiles for all
  using (auth.role() = 'service_role');
