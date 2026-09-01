-- Phase 4: League registration mode (individual/team)

do $$
begin
  alter table public.leagues add column registration_mode text not null default 'individual';
exception
  when duplicate_column then null;
end $$;

do $$
begin
  alter table public.leagues
    add constraint leagues_registration_mode_check
    check (registration_mode in ('individual', 'team'));
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_leagues_registration_mode on public.leagues(registration_mode);
