-- ============================================================================
-- Hadfield Early Learning Centre: Database RLS & Educator Access Fix
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/zcslgqitzkmxwusrqlsu/sql
-- ============================================================================

-- 1. Ensure columns and constraints on public.teacher_access
alter table public.teacher_access alter column user_id drop not null;
alter table public.teacher_access add column if not exists is_admin boolean not null default false;
alter table public.teacher_access add column if not exists centre_name text not null default 'Hadfield Early Learning Centre';
alter table public.teacher_access add column if not exists password text default 'Educator2026!';
alter table public.teacher_access add column if not exists role text not null default 'Educator';
alter table public.teacher_access add column if not exists room text not null default 'All Rooms';
alter table public.teacher_access add column if not exists status text not null default 'active';
alter table public.teacher_access add column if not exists notes text default '';
alter table public.teacher_access add column if not exists invited_at timestamptz default now();
alter table public.teacher_access add column if not exists last_active_at timestamptz default now();

create index if not exists teacher_access_email_idx on public.teacher_access (email);
create index if not exists teacher_access_centre_name_idx on public.teacher_access (centre_name);

-- 2. Permissive RLS for teacher_access (Permits reading roster & authorizing educators)
alter table public.teacher_access enable row level security;
drop policy if exists "own rows" on public.teacher_access;
drop policy if exists "teacher_access_read" on public.teacher_access;
drop policy if exists "teacher_access_write" on public.teacher_access;
drop policy if exists "teacher_access_public_read" on public.teacher_access;
drop policy if exists "teacher_access_public_write" on public.teacher_access;

create policy "teacher_access_read" on public.teacher_access
  for select using (true);

create policy "teacher_access_write" on public.teacher_access
  for all using (true) with check (true);

-- 3. Ensure columns and constraints on public.rooms
alter table public.rooms alter column user_id drop not null;
alter table public.rooms add column if not exists centre_name text not null default 'Hadfield Early Learning Centre';
alter table public.rooms add column if not exists description text default '';
alter table public.rooms add column if not exists sort_order int not null default 0;
alter table public.rooms add column if not exists is_active boolean not null default true;

create index if not exists rooms_centre_name_idx on public.rooms (centre_name);

-- Permissive RLS for rooms
alter table public.rooms enable row level security;
drop policy if exists "own rows" on public.rooms;
drop policy if exists "rooms_read" on public.rooms;
drop policy if exists "rooms_write" on public.rooms;

create policy "rooms_read" on public.rooms
  for select using (true);

create policy "rooms_write" on public.rooms
  for all using (true) with check (true);

-- 4. Permissive RLS for centres
alter table public.centres enable row level security;
drop policy if exists "own rows" on public.centres;
drop policy if exists "centres_read" on public.centres;
drop policy if exists "centres_write" on public.centres;

create policy "centres_read" on public.centres
  for select using (true);

create policy "centres_write" on public.centres
  for all using (true) with check (true);

-- 5. Permissive RLS for topic_statuses
alter table public.topic_statuses alter column user_id drop not null;
alter table public.topic_statuses enable row level security;
drop policy if exists "own rows" on public.topic_statuses;
drop policy if exists "topic_statuses_read" on public.topic_statuses;
drop policy if exists "topic_statuses_write" on public.topic_statuses;

create policy "topic_statuses_read" on public.topic_statuses
  for select using (true);

create policy "topic_statuses_write" on public.topic_statuses
  for all using (true) with check (true);

-- 6. Shared centre documentation tables
alter table public.learning_stories enable row level security;
drop policy if exists "own rows" on public.learning_stories;
drop policy if exists "learning_stories_read" on public.learning_stories;
drop policy if exists "learning_stories_write" on public.learning_stories;
create policy "learning_stories_read" on public.learning_stories for select using (true);
create policy "learning_stories_write" on public.learning_stories for all using (true) with check (true);

alter table public.projects enable row level security;
drop policy if exists "own rows" on public.projects;
drop policy if exists "projects_read" on public.projects;
drop policy if exists "projects_write" on public.projects;
create policy "projects_read" on public.projects for select using (true);
create policy "projects_write" on public.projects for all using (true) with check (true);

alter table public.weekly_wrap_ups enable row level security;
drop policy if exists "own rows" on public.weekly_wrap_ups;
drop policy if exists "weekly_wrap_ups_read" on public.weekly_wrap_ups;
drop policy if exists "weekly_wrap_ups_write" on public.weekly_wrap_ups;
create policy "weekly_wrap_ups_read" on public.weekly_wrap_ups for select using (true);
create policy "weekly_wrap_ups_write" on public.weekly_wrap_ups for all using (true) with check (true);

alter table public.program_book_analyses enable row level security;
drop policy if exists "own rows" on public.program_book_analyses;
drop policy if exists "program_book_analyses_read" on public.program_book_analyses;
drop policy if exists "program_book_analyses_write" on public.program_book_analyses;
create policy "program_book_analyses_read" on public.program_book_analyses for select using (true);
create policy "program_book_analyses_write" on public.program_book_analyses for all using (true) with check (true);

alter table public.newsletters enable row level security;
drop policy if exists "own rows" on public.newsletters;
drop policy if exists "newsletters_read" on public.newsletters;
drop policy if exists "newsletters_write" on public.newsletters;
create policy "newsletters_read" on public.newsletters for select using (true);
create policy "newsletters_write" on public.newsletters for all using (true) with check (true);

alter table public.activities enable row level security;
drop policy if exists "own rows" on public.activities;
drop policy if exists "activities_read" on public.activities;
drop policy if exists "activities_write" on public.activities;
create policy "activities_read" on public.activities for select using (true);
create policy "activities_write" on public.activities for all using (true) with check (true);

alter table public.profiles enable row level security;
drop policy if exists "own rows" on public.profiles;
drop policy if exists "profiles_read" on public.profiles;
drop policy if exists "profiles_write" on public.profiles;
create policy "profiles_read" on public.profiles for select using (true);
create policy "profiles_write" on public.profiles for all using (true) with check (true);

-- 7. Ensure Master Administrator is registered in teacher_access
insert into public.teacher_access (email, name, role, room, status, is_admin, centre_name, password, notes)
select 'info@pandeykapil.com.np', 'Kapil Pandey', 'System Administrator', 'No Room (Admin Privacy)', 'active', true, 'Platform Administration', 'password123', 'Platform Super Administrator with complete child privacy separation.'
where not exists (select 1 from public.teacher_access where email = 'info@pandeykapil.com.np');

update public.teacher_access
set role = 'System Administrator',
    is_admin = true,
    centre_name = 'Platform Administration',
    room = 'No Room (Admin Privacy)'
where email = 'info@pandeykapil.com.np';

-- 8. Seed Default Rooms for Hadfield Early Learning Centre if missing
insert into public.rooms (name, centre_name, description, sort_order, is_active)
select 'Blossoms', 'Hadfield Early Learning Centre', 'Nursery & infant exploration room', 0, true
where not exists (select 1 from public.rooms where name = 'Blossoms' and centre_name = 'Hadfield Early Learning Centre');

insert into public.rooms (name, centre_name, description, sort_order, is_active)
select 'Sweet Peas', 'Hadfield Early Learning Centre', 'Young toddlers inquiry room', 1, true
where not exists (select 1 from public.rooms where name = 'Sweet Peas' and centre_name = 'Hadfield Early Learning Centre');

insert into public.rooms (name, centre_name, description, sort_order, is_active)
select 'Chamomiles', 'Hadfield Early Learning Centre', 'Toddlers sensory & loose parts room', 2, true
where not exists (select 1 from public.rooms where name = 'Chamomiles' and centre_name = 'Hadfield Early Learning Centre');

insert into public.rooms (name, centre_name, description, sort_order, is_active)
select 'Dandelions', 'Hadfield Early Learning Centre', 'Kindergarten inquiry & culinary exploration room', 3, true
where not exists (select 1 from public.rooms where name = 'Dandelions' and centre_name = 'Hadfield Early Learning Centre');

insert into public.rooms (name, centre_name, description, sort_order, is_active)
select 'Butter Beans', 'Hadfield Early Learning Centre', 'Pre-kindy schema play & language room', 4, true
where not exists (select 1 from public.rooms where name = 'Butter Beans' and centre_name = 'Hadfield Early Learning Centre');

insert into public.rooms (name, centre_name, description, sort_order, is_active)
select 'Rosellas', 'Hadfield Early Learning Centre', 'Early literacy & creative arts room', 5, true
where not exists (select 1 from public.rooms where name = 'Rosellas' and centre_name = 'Hadfield Early Learning Centre');

insert into public.rooms (name, centre_name, description, sort_order, is_active)
select 'Wattles', 'Hadfield Early Learning Centre', 'Nature-inspired STEM room', 6, true
where not exists (select 1 from public.rooms where name = 'Wattles' and centre_name = 'Hadfield Early Learning Centre');
