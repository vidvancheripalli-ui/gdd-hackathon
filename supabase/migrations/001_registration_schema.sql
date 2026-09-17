create type public.attempt_status as enum ('created', 'verified', 'payment_submitted', 'pending_review', 'approved', 'rejected');
create type public.payment_status as enum ('submitted', 'under_review', 'approved', 'rejected');

create table public.registration_attempts (
  id uuid primary key default gen_random_uuid(), auth_user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null, status public.attempt_status not null default 'created',
  expires_at timestamptz not null default now() + interval '30 minutes', created_at timestamptz not null default now()
);
create table public.registrations (
  id uuid primary key default gen_random_uuid(), auth_user_id uuid not null references auth.users(id), team_name text not null,
  team_size smallint not null check (team_size between 1 and 4), hackathon_domain text not null, leader_name text not null,
  leader_roll_no text not null unique, leader_branch text not null, leader_section text not null, leader_email text not null,
  leader_phone text not null, leader_year text not null, status public.attempt_status not null default 'pending_review',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.registration_members (
  id uuid primary key default gen_random_uuid(), registration_id uuid not null references public.registrations(id) on delete cascade,
  name text not null, roll_no text not null unique, branch text not null, section text not null, email text not null, created_at timestamptz not null default now()
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), registration_id uuid not null unique references public.registrations(id) on delete cascade,
  transaction_id text not null unique, drive_file_id text not null, status public.payment_status not null default 'under_review',
  submitted_at timestamptz not null default now(), verified_at timestamptz, rejection_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index registration_attempts_owner_idx on public.registration_attempts(auth_user_id, expires_at);
alter table public.registration_attempts enable row level security;
alter table public.registrations enable row level security;
alter table public.registration_members enable row level security;
alter table public.payments enable row level security;
-- No direct client policies: sensitive writes/reads are exclusively through Edge Functions.
