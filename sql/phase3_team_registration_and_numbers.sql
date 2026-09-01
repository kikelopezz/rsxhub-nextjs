-- Phase 3: Team registrations by class + driver number preferences

create table if not exists public.driver_number_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  class_tag text not null,
  number_1 int,
  number_2 int,
  number_3 int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, class_tag)
);

do $$
begin
  alter table public.league_registrations add column team_id uuid references public.teams(id) on delete set null;
exception
  when duplicate_column then null;
end $$;

do $$
begin
  alter table public.league_registrations add column class_tag text;
exception
  when duplicate_column then null;
end $$;

do $$
begin
  alter table public.league_registrations add column assigned_number int;
exception
  when duplicate_column then null;
end $$;

create table if not exists public.league_team_registrations (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  class_tag text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_by_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, team_id, class_tag)
);

create table if not exists public.league_team_registration_drivers (
  id uuid primary key default gen_random_uuid(),
  team_registration_id uuid not null references public.league_team_registrations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  assigned_number int,
  created_at timestamptz not null default now(),
  unique (team_registration_id, user_id)
);

create index if not exists idx_driver_number_preferences_user on public.driver_number_preferences(user_id);
create index if not exists idx_league_registrations_class on public.league_registrations(league_id, class_tag);
create index if not exists idx_league_team_registrations_league on public.league_team_registrations(league_id);
create index if not exists idx_league_team_registration_drivers_team on public.league_team_registration_drivers(team_registration_id);
