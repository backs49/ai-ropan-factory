-- Add AI provider column to profiles
alter table profiles add column ai_provider text not null default 'gemini';
