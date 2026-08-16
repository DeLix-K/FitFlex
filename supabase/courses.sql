-- Adds paid courses with a completion certificate: admin-authored courses
-- and text/video lessons, one-time Stripe purchase (paid directly to the
-- platform — no Stripe Connect needed since there's no third-party seller),
-- and per-lesson completion tracking.
-- Run this in the Supabase SQL Editor.

-- ─────────────────────────────────────────────
-- Courses: public catalog, admin-only writes (same pattern as exercises
-- and challenges).
-- ─────────────────────────────────────────────
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  price_cents int not null,
  created_at timestamptz not null default now()
);

alter table courses enable row level security;

drop policy if exists "Courses are readable by anyone" on courses;
create policy "Courses are readable by anyone"
  on courses for select
  using (true);

drop policy if exists "Only the admin can manage courses" on courses;
create policy "Only the admin can manage courses"
  on courses for all
  using (auth.jwt() ->> 'email' = 'teamlix6@gmail.com')
  with check (auth.jwt() ->> 'email' = 'teamlix6@gmail.com');

-- ─────────────────────────────────────────────
-- Course enrollments: one row per user per course. No client-side writes —
-- created by create-course-checkout (pending), marked paid by stripe-webhook,
-- both service-role only. Users can read their own rows to know what they
-- own and unlock lesson content (via the RLS policy on course_lessons below).
-- Defined before course_lessons since that table's RLS policy references it.
-- ─────────────────────────────────────────────
create table if not exists course_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  stripe_checkout_session_id text,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

alter table course_enrollments enable row level security;

drop policy if exists "Users view their own enrollments" on course_enrollments;
create policy "Users view their own enrollments"
  on course_enrollments for select
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- Course lessons: full content (text + optional video_url, same pattern as
-- exercises.video_url) is only readable by users with a paid enrollment.
-- Admin-only writes. Browsing without buying only sees titles, via the
-- course_lesson_previews view below.
-- ─────────────────────────────────────────────
create table if not exists course_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  content text not null default '',
  video_url text default '',
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

alter table course_lessons enable row level security;

drop policy if exists "Only the admin can manage course lessons" on course_lessons;
create policy "Only the admin can manage course lessons"
  on course_lessons for all
  using (auth.jwt() ->> 'email' = 'teamlix6@gmail.com')
  with check (auth.jwt() ->> 'email' = 'teamlix6@gmail.com');

drop policy if exists "Enrolled users can read lesson content" on course_lessons;
create policy "Enrolled users can read lesson content"
  on course_lessons for select
  using (
    exists (
      select 1 from course_enrollments
      where course_enrollments.course_id = course_lessons.course_id
        and course_enrollments.user_id = auth.uid()
        and course_enrollments.status = 'paid'
    )
  );

-- Public syllabus preview: titles and order only, no content/video_url, so
-- anyone can see what's included before buying.
create or replace view course_lesson_previews
with (security_invoker = false) as
select id, course_id, title, order_index
from course_lessons;

-- ─────────────────────────────────────────────
-- Lesson progress: private per user, powers the completion certificate
-- (100% of a course's lessons marked complete).
-- ─────────────────────────────────────────────
create table if not exists course_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references course_lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

alter table course_lesson_progress enable row level security;

drop policy if exists "Users manage their own lesson progress" on course_lesson_progress;
create policy "Users manage their own lesson progress"
  on course_lesson_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select on courses to anon, authenticated;
grant insert, update, delete on courses to authenticated;
grant select on courses to service_role;
grant select on course_lessons to authenticated;
grant insert, update, delete on course_lessons to authenticated;
grant select on course_lesson_previews to anon, authenticated;
grant select on course_enrollments to authenticated;
grant select, insert, update on course_enrollments to service_role;
grant select, insert, update, delete on course_lesson_progress to authenticated;
