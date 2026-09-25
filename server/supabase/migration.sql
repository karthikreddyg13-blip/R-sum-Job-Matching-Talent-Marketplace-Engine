-- ============================================================================
-- TalentMatch — Supabase migration 0001_init
-- Run in the Supabase SQL Editor (or `supabase db push` with the CLI).
-- Creates: profiles, candidates, recruiters, skills, candidate_skills,
--          jobs, job_skills, applications, saved_jobs, recommendations, roadmaps
--
-- auth.users (Supabase Auth) 1—1 profiles 1—1 candidates | recruiters
-- candidates ──< candidate_skills >── skills
-- jobs       ──< job_skills       >── skills
-- candidates ──< applications >── jobs
-- candidates ──< saved_jobs   >── jobs
-- candidates ──< roadmaps     >── jobs
-- profiles   ──< recommendations
-- ============================================================================

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('candidate','recruiter','admin')),
  full_name  text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- candidates
create table if not exists public.candidates (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null unique references public.profiles(id) on delete cascade,
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

-- ---------------------------------------------------------------- companies
create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  industry   text not null default '',
  location   text not null default '',
  about      text not null default '',
  website    text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- recruiters
create table if not exists public.recruiters (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null unique references public.profiles(id) on delete cascade,
  company_id   uuid references public.companies(id) on delete set null,
  company_name text not null,
  industry     text not null default '',
  location     text not null default '',
  about        text not null default '',
  website      text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------- skills
create table if not exists public.skills (
  id       uuid primary key default gen_random_uuid(),
  name     text not null unique,
  category text
);

-- ---------------------------------------------------------------- jobs
create table if not exists public.jobs (
  id                   uuid primary key default gen_random_uuid(),
  recruiter_id         uuid not null references public.recruiters(id) on delete cascade,
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

-- ---------------------------------------------------------------- job_skills
create table if not exists public.job_skills (
  job_id   uuid not null references public.jobs(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  weight   numeric(2,1) not null default 3 check (weight between 1 and 5),
  primary key (job_id, skill_id)
);

-- ---------------------------------------------------------------- candidate_skills
create table if not exists public.candidate_skills (
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  skill_id     uuid not null references public.skills(id) on delete cascade,
  proficiency  numeric(2,1) not null default 3 check (proficiency between 1 and 5),
  primary key (candidate_id, skill_id)
);

-- ---------------------------------------------------------------- applications
create table if not exists public.applications (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  match_score  numeric(5,1) not null default 0,
  status       text not null default 'applied'
               check (status in ('applied','review','interview','offer','rejected')),
  note         text,
  applied_at   timestamptz not null default now(),
  unique (job_id, candidate_id)
);

-- ---------------------------------------------------------------- saved_jobs
create table if not exists public.saved_jobs (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  job_id       uuid not null references public.jobs(id) on delete cascade,
  saved_at     timestamptz not null default now(),
  unique (candidate_id, job_id)
);

-- ---------------------------------------------------------------- recommendations
create table if not exists public.recommendations (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  kind         text not null
               check (kind in ('jobs-for-candidate','candidates-for-job','similar-jobs')),
  ref_id       text not null,
  top_score    numeric(5,1) not null default 0,
  items        jsonb not null default '[]'::jsonb,
  algorithm    text not null default 'weighted-score + maxheap top-k',
  generated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- roadmaps
create table if not exists public.roadmaps (
  id                  uuid primary key default gen_random_uuid(),
  candidate_id        uuid not null references public.candidates(id) on delete cascade,
  job_id              uuid not null references public.jobs(id) on delete cascade,
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
create index if not exists idx_jobs_active        on public.jobs(active);
create index if not exists idx_jobs_recruiter     on public.jobs(recruiter_id);
create index if not exists idx_apps_job           on public.applications(job_id);
create index if not exists idx_apps_candidate     on public.applications(candidate_id);
create index if not exists idx_saved_candidate    on public.saved_jobs(candidate_id);
create index if not exists idx_cs_skill           on public.candidate_skills(skill_id);
create index if not exists idx_js_skill           on public.job_skills(skill_id);
create index if not exists idx_roadmaps_candidate on public.roadmaps(candidate_id);
create index if not exists idx_recs_profile       on public.recommendations(profile_id);
create index if not exists idx_recruiters_company on public.recruiters(company_id);

-- ============================================================================
-- updated_at trigger
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_candidates_updated on public.candidates;
create trigger trg_candidates_updated
  before update on public.candidates
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles         enable row level security;
alter table public.candidates       enable row level security;
alter table public.recruiters       enable row level security;
alter table public.skills           enable row level security;
alter table public.jobs             enable row level security;
alter table public.job_skills       enable row level security;
alter table public.candidate_skills enable row level security;
alter table public.applications     enable row level security;
alter table public.saved_jobs       enable row level security;
alter table public.recommendations  enable row level security;
alter table public.roadmaps         enable row level security;

-- profiles: own row only
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- candidates: public read (ranking needs it), own write
create policy "candidates_select_all" on public.candidates
  for select using (true);
create policy "candidates_write_own" on public.candidates
  for all using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- recruiters: public read, own write
create policy "recruiters_select_all" on public.recruiters
  for select using (true);
create policy "recruiters_write_own" on public.recruiters
  for all using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- skills: public read, authenticated insert
create policy "skills_select_all" on public.skills
  for select using (true);
create policy "skills_insert_auth" on public.skills
  for insert with check (auth.uid() is not null);


-- companies: public read, admins manage
create policy "companies_select_all" on public.companies
  for select using (true);
create policy "companies_admin_write" on public.companies
  for all using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin'));

-- jobs: public read, owner manage
create policy "jobs_select_all" on public.jobs
  for select using (true);
create policy "jobs_write_own" on public.jobs
  for all using (
    exists (select 1 from public.recruiters r
            where r.id = recruiter_id and r.profile_id = auth.uid()))
  with check (
    exists (select 1 from public.recruiters r
            where r.id = recruiter_id and r.profile_id = auth.uid()));

-- job_skills: public read, owner of the job writes
create policy "js_select_all" on public.job_skills
  for select using (true);
create policy "js_write_own" on public.job_skills
  for all using (
    exists (select 1 from public.jobs j
            join public.recruiters r on r.id = j.recruiter_id
            where j.id = job_id and r.profile_id = auth.uid()))
  with check (
    exists (select 1 from public.jobs j
            join public.recruiters r on r.id = j.recruiter_id
            where j.id = job_id and r.profile_id = auth.uid()));

-- candidate_skills: public read, own write
create policy "cs_select_all" on public.candidate_skills
  for select using (true);
create policy "cs_write_own" on public.candidate_skills
  for all using (
    exists (select 1 from public.candidates c
            where c.id = candidate_id and c.profile_id = auth.uid()))
  with check (
    exists (select 1 from public.candidates c
            where c.id = candidate_id and c.profile_id = auth.uid()));

-- applications: candidate inserts/reads own; recruiter reads/updates for own jobs
create policy "apps_candidate_select" on public.applications
  for select using (
    exists (select 1 from public.candidates c
            where c.id = candidate_id and c.profile_id = auth.uid()));
create policy "apps_candidate_insert" on public.applications
  for insert with check (
    exists (select 1 from public.candidates c
            where c.id = candidate_id and c.profile_id = auth.uid()));
create policy "apps_recruiter_select" on public.applications
  for select using (
    exists (select 1 from public.jobs j
            join public.recruiters r on r.id = j.recruiter_id
            where j.id = job_id and r.profile_id = auth.uid()));
create policy "apps_recruiter_update" on public.applications
  for update using (
    exists (select 1 from public.jobs j
            join public.recruiters r on r.id = j.recruiter_id
            where j.id = job_id and r.profile_id = auth.uid()));

-- saved_jobs: owner only
create policy "saved_all_own" on public.saved_jobs
  for all using (
    exists (select 1 from public.candidates c
            where c.id = candidate_id and c.profile_id = auth.uid()))
  with check (
    exists (select 1 from public.candidates c
            where c.id = candidate_id and c.profile_id = auth.uid()));

-- recommendations: own rows (engine writes via service role)
create policy "recs_select_own" on public.recommendations
  for select using (auth.uid() = profile_id);

-- roadmaps: owner only
create policy "roadmaps_all_own" on public.roadmaps
  for all using (
    exists (select 1 from public.candidates c
            where c.id = candidate_id and c.profile_id = auth.uid()))
  with check (
    exists (select 1 from public.candidates c
            where c.id = candidate_id and c.profile_id = auth.uid()));
