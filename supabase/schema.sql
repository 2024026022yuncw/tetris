-- Supabase schema for supabase-tetris.
-- Run this in the Supabase SQL editor (or `supabase db query < schema.sql`).

create table if not exists public.scores (
  id         bigserial primary key,
  nickname   text not null check (char_length(nickname) between 1 and 16),
  score      integer not null check (score >= 0),
  lines      integer not null default 0,
  level      integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists scores_score_desc on public.scores (score desc, created_at asc);

create table if not exists public.feedback (
  id         bigserial primary key,
  name       text not null default 'Anonymous' check (char_length(name) between 1 and 20),
  message    text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_desc on public.feedback (created_at desc);

alter table public.scores   enable row level security;
alter table public.feedback enable row level security;

-- Anonymous reads + writes (no updates/deletes).
drop policy if exists "anon can read scores"    on public.scores;
drop policy if exists "anon can insert scores"  on public.scores;
drop policy if exists "anon can read feedback"  on public.feedback;
drop policy if exists "anon can insert feedback" on public.feedback;

create policy "anon can read scores"    on public.scores   for select to anon using (true);
create policy "anon can insert scores"  on public.scores   for insert to anon with check (true);
create policy "anon can read feedback"   on public.feedback for select to anon using (true);
create policy "anon can insert feedback" on public.feedback for insert to anon with check (true);
