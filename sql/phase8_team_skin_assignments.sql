-- Phase 8: assign team skins by league + car number

do $$
begin
  alter table public.teams
    add column if not exists skin_assignments jsonb not null default '[]'::jsonb;
exception
  when undefined_table then null;
end $$;
