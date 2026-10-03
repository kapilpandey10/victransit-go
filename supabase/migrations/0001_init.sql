-- =====================================================================
-- Hadfield Inquiry Planner — initial schema
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- Every table carries `user_id` so Row Level Security can scope rows to the
-- signed-in educator. Educators only ever see their own data.
-- =====================================================================

-- -------------------------------------------------------------------------
-- Helper: keep `updated_at` fresh.
-- -------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -------------------------------------------------------------------------
-- Profiles (one row per Supabase Auth user; writeable only by that user).
-- -------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  centre_name text,
  room text,
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "own profile read" on public.profiles;
drop policy if exists "own profile write" on public.profiles;

create policy "own profile read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "own profile write"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- Auto-create a profile row when a user signs up.
-- -------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------------------
-- Projects (inquiry topics).
-- -------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text default '',
  inquiry_question text default '',
  age_group text default '',
  room text default '',
  status text not null default 'planning'
    check (status in ('planning', 'active', 'reflecting', 'archived')),
  eylf_outcome_ids int[] not null default '{}',
  theory_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- Mind-map nodes. Parent links use text ids so the client can reuse ids
-- across the Supabase/local demo boundary.
-- -------------------------------------------------------------------------
create table if not exists public.mindmap_nodes (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  parent_id text,
  text text not null default '',
  note text default '',
  node_type text not null default 'theme'
    check (node_type in ('theme', 'question', 'activity', 'resource', 'theory', 'outcome')),
  color text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mindmap_nodes_project_idx
  on public.mindmap_nodes (project_id);

-- -------------------------------------------------------------------------
-- Learning stories.
-- -------------------------------------------------------------------------
create table if not exists public.learning_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  child_name text not null default '',
  title text not null default '',
  setting text default '',
  narrative text not null default '',
  analysis text default '',
  educator_reflection text default '',
  next_steps text default '',
  eylf_outcome_ids int[] not null default '{}',
  theory_ids text[] not null default '{}',
  photo_urls text[] not null default '{}',
  story_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_stories_project_idx
  on public.learning_stories (project_id);

-- -------------------------------------------------------------------------
-- Activities (experiences planned inside or outside projects).
-- -------------------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title text not null default '',
  description text default '',
  learning_intentions text default '',
  success_criteria text default '',
  extension_ideas text default '',
  eylf_outcome_ids int[] not null default '{}',
  theory_ids text[] not null default '{}',
  resources text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activities_project_idx
  on public.activities (project_id);

-- -------------------------------------------------------------------------
-- Newsletters.
-- -------------------------------------------------------------------------
create table if not exists public.newsletters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  content text not null default '',
  term text default '',
  date_from date,
  date_to date,
  eylf_outcome_ids int[] not null default '{}',
  highlights text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- Program-book analyses.
-- -------------------------------------------------------------------------
create table if not exists public.program_book_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  source_text text not null default '',
  summary text default '',
  strengths text[] default '{}',
  gaps text[] default '{}',
  recommendations text[] default '{}',
  coverage jsonb not null default '{}'::jsonb,
  eylf_outcome_ids int[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- Row Level Security: every table is private to its owning educator.
-- -------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.mindmap_nodes enable row level security;
alter table public.learning_stories enable row level security;
alter table public.activities enable row level security;
alter table public.newsletters enable row level security;
alter table public.program_book_analyses enable row level security;

drop policy if exists "own rows" on public.projects;
drop policy if exists "own rows" on public.mindmap_nodes;
drop policy if exists "own rows" on public.learning_stories;
drop policy if exists "own rows" on public.activities;
drop policy if exists "own rows" on public.newsletters;
drop policy if exists "own rows" on public.program_book_analyses;

create policy "own rows" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.mindmap_nodes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.learning_stories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.activities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.newsletters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.program_book_analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -------------------------------------------------------------------------
-- `updated_at` triggers for every table.
-- -------------------------------------------------------------------------
drop trigger if exists projects_updated_at on public.projects;
drop trigger if exists mindmap_nodes_updated_at on public.mindmap_nodes;
drop trigger if exists learning_stories_updated_at on public.learning_stories;
drop trigger if exists activities_updated_at on public.activities;
drop trigger if exists newsletters_updated_at on public.newsletters;
drop trigger if exists program_book_analyses_updated_at on public.program_book_analyses;

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();
create trigger mindmap_nodes_updated_at
  before update on public.mindmap_nodes
  for each row execute function public.set_updated_at();
create trigger learning_stories_updated_at
  before update on public.learning_stories
  for each row execute function public.set_updated_at();
create trigger activities_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();
create trigger newsletters_updated_at
  before update on public.newsletters
  for each row execute function public.set_updated_at();
create trigger program_book_analyses_updated_at
  before update on public.program_book_analyses
  for each row execute function public.set_updated_at();
