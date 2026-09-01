-- Phase 5: allow one user to belong to multiple teams

do $$
begin
  -- Remove accidental one-team-only constraints if they exist.
  alter table public.team_members drop constraint if exists team_members_user_id_key;
exception
  when undefined_table then null;
end $$;

drop index if exists public.team_members_user_id_key;

do $$
begin
  alter table public.team_members
    add constraint team_members_team_id_user_id_key unique (team_id, user_id);
exception
  when duplicate_table then null;
  when duplicate_object then null;
  when undefined_table then null;
end $$;

create index if not exists idx_team_members_user on public.team_members(user_id);
