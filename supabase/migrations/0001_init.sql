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
  family_link text default '',
  educator_name text default '',
  eylf_outcome_ids int[] not null default '{}',
  theory_ids text[] not null default '{}',
  photo_urls text[] default '{}',
  story_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_stories_project_idx
  on public.learning_stories (project_id);

-- -------------------------------------------------------------------------
-- Activities (experiences planned inside or outside projects / Programming Book).
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
  room text default '',
  experience_type text default 'group',
  date date default current_date,
  photo_urls text[] default '{}',
  educator_name text default '',
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

-- -------------------------------------------------------------------------
-- Weekly Wrap-Up — one draft per room + week (Mon–Fri daily notes and the
-- AI-compiled Friday newsletter).
-- -------------------------------------------------------------------------
create table if not exists public.weekly_wrap_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  room text not null default '',
  -- YYYY-MM-DD of the Monday (storage key per room+week)
  week_start date not null,
  -- Raw daily jot notes keyed mon..fri
  days jsonb not null default '{}'::jsonb,
  reminders text default '',
  lost_found text default '',
  extra_message text default '',
  result text default '',
  status text not null default 'draft' check (status in ('draft', 'generated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists weekly_wrap_ups_user_week_idx
  on public.weekly_wrap_ups (user_id, week_start);

alter table public.weekly_wrap_ups enable row level security;

drop policy if exists "own rows" on public.weekly_wrap_ups;
create policy "own rows" on public.weekly_wrap_ups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists weekly_wrap_ups_updated_at on public.weekly_wrap_ups;
create trigger weekly_wrap_ups_updated_at
  before update on public.weekly_wrap_ups
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- Teacher Access Control (admin-managed educator email invitations and roles)
-- -------------------------------------------------------------------------
create table if not exists public.teacher_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  name text not null,
  role text not null default 'Educator',
  room text not null default 'All Rooms',
  status text not null default 'active' check (status in ('active', 'invited', 'suspended')),
  is_admin boolean not null default false,
  notes text default '',
  invited_at timestamptz default now(),
  last_active_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teacher_access_email_idx on public.teacher_access (email);
alter table public.teacher_access enable row level security;
drop policy if exists "own rows" on public.teacher_access;
drop policy if exists "teacher_access_read" on public.teacher_access;
drop policy if exists "teacher_access_write" on public.teacher_access;

create policy "teacher_access_read" on public.teacher_access
  for select using (true);

create policy "teacher_access_write" on public.teacher_access
  for all using (true) with check (true);

drop trigger if exists teacher_access_updated_at on public.teacher_access;
create trigger teacher_access_updated_at
  before update on public.teacher_access
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- Topic Module Statuses (Under Development flags, leadership guidance notes)
-- -------------------------------------------------------------------------
create table if not exists public.topic_statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  topic_key text not null,
  title text not null,
  icon text not null default '📌',
  route_path text not null,
  status text not null default 'active' check (status in ('active', 'under_development', 'beta', 'disabled')),
  leadership_notes text default '',
  target_release_date text default '',
  affected_rooms jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists topic_statuses_key_idx on public.topic_statuses (topic_key);
alter table public.topic_statuses enable row level security;
drop policy if exists "own rows" on public.topic_statuses;
drop policy if exists "topic_statuses_read" on public.topic_statuses;
drop policy if exists "topic_statuses_write" on public.topic_statuses;

create policy "topic_statuses_read" on public.topic_statuses
  for select using (true);

create policy "topic_statuses_write" on public.topic_statuses
  for all using (true) with check (true);

drop trigger if exists topic_statuses_updated_at on public.topic_statuses;
create trigger topic_statuses_updated_at
  before update on public.topic_statuses
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- Rooms (Dynamic room configurations managed by administration)
-- -------------------------------------------------------------------------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  description text default '',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rooms_name_idx on public.rooms (name);
alter table public.rooms enable row level security;
drop policy if exists "own rows" on public.rooms;
drop policy if exists "rooms_read" on public.rooms;
drop policy if exists "rooms_write" on public.rooms;

create policy "rooms_read" on public.rooms
  for select using (true);

create policy "rooms_write" on public.rooms
  for all using (true) with check (true);

drop trigger if exists rooms_updated_at on public.rooms;
create trigger rooms_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- Initial Seed Data: Service Director, Educators, and Learning Rooms
-- -------------------------------------------------------------------------
insert into public.teacher_access (email, name, role, room, status, is_admin, notes)
values
  ('kapilpandey@hadfield.edu.au', 'Kapil Pandey', 'Centre Director', 'All Rooms', 'active', true, 'Service Director and System Administrator.'),
  ('jean@hadfield.edu.au', 'Jean', 'Educational Leader', 'All Rooms', 'active', false, 'Curriculum oversight, pedagogical reflection, and educator coaching.'),
  ('lakshmi@hadfield.edu.au', 'Lakshmi', 'Early Childhood Teacher', 'Dandelions', 'active', false, 'Funded Kindergarten program lead and STEM investigations.'),
  ('kelly.goodsir@hadfield.edu.au', 'Kelly Goodsir', 'Room Leader', 'Butter Beans', 'active', false, 'Toddler room inquiry and play schema documentation.'),
  ('nikki@hadfield.edu.au', 'Nikki', 'Early Childhood Teacher', 'Rosellas', 'invited', false, 'Pre-kindergarten early literacy and transitions.'),
  ('sarah.j@hadfield.edu.au', 'Sarah Jenkins', 'Educator', 'Blossoms', 'active', false, 'Nursery infant sensory play and primary caregiving.')
on conflict do nothing;

insert into public.rooms (name, description, sort_order, is_active)
values
  ('Blossoms', 'Nursery & infant exploration room', 0, true),
  ('Sweet Peas', 'Young toddlers inquiry room', 1, true),
  ('Chamomiles', 'Toddlers sensory & loose parts room', 2, true),
  ('Dandelions', 'Kindergarten inquiry & culinary exploration room', 3, true),
  ('Butter Beans', 'Pre-kindy schema play & language room', 4, true),
  ('Rosellas', 'Early literacy & creative arts room', 5, true),
  ('Wattles', 'Nature-inspired STEM room', 6, true)
on conflict do nothing;



