-- Phase 6: support multiple cars per team in the same league/class

do $$
begin
  alter table public.league_team_registrations
    add column if not exists car_number int;
exception
  when undefined_table then null;
end $$;

-- Backfill existing rows to avoid nulls in unique indexes.
update public.league_team_registrations
set car_number = 0
where car_number is null;

do $$
begin
  alter table public.league_team_registrations
    alter column car_number set not null;
exception
  when undefined_table then null;
end $$;

do $$
begin
  alter table public.league_team_registrations
    add constraint league_team_registrations_car_number_range
    check (car_number >= 0 and car_number <= 999);
exception
  when duplicate_object then null;
  when undefined_table then null;
end $$;

-- Replace old unique (league_id, team_id, class_tag) with car-aware uniqueness.
alter table public.league_team_registrations
  drop constraint if exists league_team_registrations_league_id_team_id_class_tag_key;

create unique index if not exists uq_team_car_per_class
  on public.league_team_registrations(league_id, team_id, class_tag, car_number);

-- Optional: prevent duplicated car numbers in same class for all teams.
create unique index if not exists uq_league_class_car_number
  on public.league_team_registrations(league_id, class_tag, car_number);
