create table if not exists public.league_result_imports (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  event_id uuid not null references public.league_events(id) on delete cascade,
  uploaded_by_user_id uuid not null references public.users(id) on delete cascade,
  file_name text not null,
  payload_text text not null,
  rows_total integer not null default 0,
  rows_imported integer not null default 0,
  rows_unresolved integer not null default 0,
  rows_not_registered integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_league_result_imports_league_event
  on public.league_result_imports(league_id, event_id, created_at desc);
