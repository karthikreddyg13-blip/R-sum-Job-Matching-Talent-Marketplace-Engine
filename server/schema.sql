-- ============================================================================
-- TalentMatch — schema.sql
-- Plain schema (no RLS) for self-hosted PostgreSQL / report documentation.
-- For Supabase use supabase/migration.sql (same tables + RLS policies).
-- Tables: profiles, companies, recruiters, candidates, skills,
--         candidate_skills, jobs, job_skills, applications, saved_jobs,
--         recommendations, roadmaps
-- ============================================================================

create table if not exists profiles (
  id         uuid primary key,                    -- = auth.users.id (Supabase) or app-issued
  role       text not null check (role in ('candidate','recruiter','admin')),
  full_name  text not null,
  created_at timestamptz not null default now()
);

create table if not exists companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  industry   text not null default '',
  location   text not null default '',
  about      text not null default '',
  website    text,
  created_at timestamptz not null default now()
);

create table if not exists recruiters (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null unique references profiles(id) on delete cascade,
  company_id   uuid references companies(id) on delete set null,
  company_name text not null,
  industry     text not null default '',
  location     text not null default '',
  about        text not null default '',
  website      text,
  created_at   timestamptz not null default now()
);

create table if not exists candidates (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null unique references profiles(id) on delete cascade,
  headline          text not null default '',
  location          text not null default '',
  education         text not null default 'bachelors'
                    check (education in ('none','diploma','bachelors','masters','phd')),
  experience_years  numeric(4,1) not null default 0 check (experience_years >= 0),
  skills            text[] not null default '{}',
  resume_text       text,
  resume_file_name  text,
  resume_url        text,
  resume_updated_at timestamptz,
  github_url        text,
  linkedin_url      text,
  phone             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists skills (
  id       uuid primary key default gen_random_uuid(),
  name     text not null unique,
  category text
);

create table if not exists jobs (
  id                   uuid primary key default gen_random_uuid(),
  recruiter_id         uuid not null references recruiters(id) on delete cascade,
  title                text not null,
  description          text not null default '',
  location             text not null default '',
  work_mode            text not null default 'onsite'
                       check (work_mode in ('onsite','remote','hybrid')),
  salary_min           numeric(12,2),
  salary_max           numeric(12,2),
  min_education        text not null default 'bachelors'
                       check (min_education in ('none','diploma','bachelors','masters','phd')),
  min_experience_years numeric(4,1) not null default 0 check (min_experience_years >= 0),
  required_skills      jsonb not null default '[]'::jsonb, -- [{name, weight 1..5}]
  posted_at            timestamptz not null default now(),
  active               boolean not null default true
);

create table if not exists job_skills (
  job_id   uuid not null references jobs(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  weight   numeric(2,1) not null default 3 check (weight between 1 and 5),
  primary key (job_id, skill_id)
);

create table if not exists candidate_skills (
  candidate_id uuid not null references candidates(id) on delete cascade,
  skill_id     uuid not null references skills(id) on delete cascade,
  proficiency  numeric(2,1) not null default 3 check (proficiency between 1 and 5),
  primary key (candidate_id, skill_id)
);

create table if not exists applications (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references jobs(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  match_score  numeric(5,1) not null default 0,
  status       text not null default 'applied'
               check (status in ('applied','review','interview','offer','rejected')),
  note         text,
  applied_at   timestamptz not null default now(),
  unique (job_id, candidate_id)
);

create table if not exists saved_jobs (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  job_id       uuid not null references jobs(id) on delete cascade,
  saved_at     timestamptz not null default now(),
  unique (candidate_id, job_id)
);

create table if not exists recommendations (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  kind         text not null
               check (kind in ('jobs-for-candidate','candidates-for-job','similar-jobs')),
  ref_id       text not null,
  top_score    numeric(5,1) not null default 0,
  items        jsonb not null default '[]'::jsonb,
  algorithm    text not null default 'weighted-score + maxheap top-k',
  generated_at timestamptz not null default now()
);

create table if not exists roadmaps (
  id                  uuid primary key default gen_random_uuid(),
  candidate_id        uuid not null references candidates(id) on delete cascade,
  job_id              uuid not null references jobs(id) on delete cascade,
  target_job_title    text not null,
  current_match_score numeric(5,1) not null default 0,
  total_months        int not null default 0,
  payload             jsonb not null default '{}'::jsonb,
  generated_at        timestamptz not null default now(),
  unique (candidate_id, job_id)
);

-- ============================================================================
-- Indexes
-- ============================================================================
create index if not exists idx_jobs_active        on jobs(active);
create index if not exists idx_jobs_recruiter     on jobs(recruiter_id);
create index if not exists idx_apps_job           on applications(job_id);
create index if not exists idx_apps_candidate     on applications(candidate_id);
create index if not exists idx_saved_candidate    on saved_jobs(candidate_id);
create index if not exists idx_cs_skill           on candidate_skills(skill_id);
create index if not exists idx_js_skill           on job_skills(skill_id);
create index if not exists idx_roadmaps_candidate on roadmaps(candidate_id);
create index if not exists idx_recs_profile       on recommendations(profile_id);
create index if not exists idx_recruiters_company on recruiters(company_id);

-- ============================================================================
-- updated_at trigger
-- ============================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_candidates_updated on candidates;
create trigger trg_candidates_updated
  before update on candidates
  for each row execute function set_updated_at();
