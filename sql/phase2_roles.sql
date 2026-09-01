create table if not exists platform_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'platform_admin', 'user')),
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

create index if not exists idx_platform_roles_user_id on platform_roles(user_id);

create table if not exists league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('league_owner', 'league_admin', 'steward', 'team_manager', 'driver')),
  created_at timestamptz not null default now(),
  unique(league_id, user_id)
);

create index if not exists idx_league_members_league_id on league_members(league_id);
create index if not exists idx_league_members_user_id on league_members(user_id);

create table if not exists circuits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  image_url text not null,
  is_system boolean not null default false,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table if exists league_events
  add column if not exists circuit_id uuid references circuits(id) on delete set null;

create index if not exists idx_league_events_circuit_id on league_events(circuit_id);

insert into circuits (name, slug, image_url, is_system)
values
  ('Daytona International Speedway', 'daytona-international-speedway', '/circuits/daytona.svg', true),
  ('Autodromo Nazionale Monza', 'autodromo-nazionale-monza', '/circuits/monza.svg', true),
  ('Circuit de Spa-Francorchamps', 'circuit-de-spa-francorchamps', '/circuits/spa.svg', true),
  ('Autodromo Enzo e Dino Ferrari', 'autodromo-enzo-e-dino-ferrari', '/circuits/imola.svg', true),
  ('Circuit de la Sarthe', 'circuit-de-la-sarthe', '/circuits/lemans.svg', true),
  ('Nurburgring GP', 'nurburgring-gp', '/circuits/nurburgring.svg', true)
on conflict (slug) do update
set name = excluded.name,
    image_url = excluded.image_url,
    is_system = excluded.is_system;

insert into platform_roles (user_id, role)
select id, 'user' from users
on conflict (user_id, role) do nothing;
