create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists steam_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  steam_id text not null unique,
  steam_display_name text not null,
  steam_profile_url text,
  steam_avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  display_name text not null,
  country_code text default 'ES',
  bio text default '',
  main_sim text not null default 'ac',
  racing_number int,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists leagues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  short_description text not null,
  full_description text not null,
  simulator text not null,
  format text not null,
  status text not null default 'draft',
  banner_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_featured boolean not null default false,
  registration_open boolean not null default false,
  max_drivers int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'platform_admin', 'user')),
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

create table if not exists league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('league_owner', 'league_admin', 'steward', 'team_manager', 'driver')),
  created_at timestamptz not null default now(),
  unique(league_id, user_id)
);

create table if not exists circuits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  image_url text not null,
  is_system boolean not null default false,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists league_events (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  circuit_id uuid references circuits(id) on delete set null,
  title text not null,
  circuit_name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists league_registrations (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  display_name text not null,
  steam_id text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, user_id)
);
