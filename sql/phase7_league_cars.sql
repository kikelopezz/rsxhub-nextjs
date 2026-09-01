-- Phase 7: league-specific car catalog and team-car model assignment

create table if not exists public.league_cars (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  label text not null,
  model text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_league_cars_league on public.league_cars(league_id, is_active, sort_order, created_at);

do $$
begin
  alter table public.league_team_registrations
    add column if not exists car_model text;
exception
  when undefined_table then null;
end $$;
