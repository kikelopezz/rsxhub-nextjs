# RSX Hub

Plataforma web de campeonatos de simracing (Assetto Corsa y Le Mans Ultimate) de Real Sim Xperience:
campeonatos, calendario, equipos y coches, mercado de pilotos, live timing, resultados y soporte.

- **Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind · Prisma + PostgreSQL
- **Login:** Steam (OpenID). No hay contraseñas.
- **Archivos:** imágenes y skins en Cloudflare R2 (con disco local como alternativa en desarrollo).
- **Servicios conectados:** bot de tickets de Discord (sección *Soporte*) y *rsxbot* (avisos a admins).

## Puesta en marcha

```bash
npm install          # también ejecuta `prisma generate`
cp .env.example .env.local   # y rellena las variables (ver abajo)
npm run dev
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | `prisma generate` + build de producción |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Tests (vitest) |
| `npm run lint` | `next lint` |

## Variables de entorno

Las de `.env.example` con su explicación. Las imprescindibles:

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | PostgreSQL (con `SHADOW_DATABASE_URL` solo para crear migraciones en local) |
| `SESSION_SECRET` | Firma de la cookie de sesión. Obligatoria; sin valor por defecto |
| `NEXT_PUBLIC_APP_URL` | URL pública del Hub. Es el origen que se acepta en el login de Steam |
| `ALLOWED_AUTH_ORIGINS` | Dominios extra permitidos para el login de Steam (separados por comas) |
| `STEAM_REALM`, `STEAM_RETURN_URL` | Realm y callback de Steam |
| `ADMIN_STEAM_IDS` | SteamIDs con acceso de *super admin* (además de los concedidos desde el panel) |
| `R2_*` | Cloudflare R2. Sin ellas las subidas van al disco local |
| `TICKET_API_URL`, `TICKET_API_KEY` | API interna del bot de tickets |

### Login de Steam

El `return_to` **no** se calcula a partir de la petición: solo se usan los orígenes de
`NEXT_PUBLIC_APP_URL`, `STEAM_REALM`, `STEAM_RETURN_URL`, `COMPETITION_PUBLIC_URL`,
`ALLOWED_AUTH_ORIGINS` y, en Vercel, las URLs del despliegue. Si el login falla en un dominio nuevo,
añádelo ahí.

## Base de datos

El esquema está en `prisma/schema.prisma` y las migraciones en `prisma/migrations/`.

```bash
npx prisma migrate deploy      # aplica las migraciones pendientes (producción)
npx prisma migrate dev         # crea una migración nueva (necesita SHADOW_DATABASE_URL)
```

Las migraciones **no se aplican solas** al desplegar: hay que lanzarlas contra la base de datos de
producción de forma consciente. La carpeta `sql/` es histórica (esquema antiguo de Supabase); la
fuente de verdad es Prisma.

## Roles

- **Plataforma:** `super_admin`, `platform_admin`, `steward`, `user`.
- **Campeonato:** `league_owner`, `league_admin`, `steward`, `team_manager`, `driver`.
- Los SteamIDs de `ADMIN_STEAM_IDS` son *super admin*; desde el panel de admin se pueden conceder más.

## Rutas principales

| Ruta | Contenido |
|---|---|
| `/ligas`, `/ligas/[slug]` | Campeonatos, inscripción, calendario y clasificación |
| `/calendario` | Calendario de sesiones y notas de admin |
| `/equipos`, `/equipos/[id]` | Equipos, pilotos, coches y alineaciones |
| `/market` | Mercado de pilotos y equipos |
| `/live-timing` | Live timing de los servidores |
| `/perfil`, `/perfil/[userId]` | Perfil del piloto (público o privado) |
| `/admin`, `/admin/ligas/[id]` | Panel de administración |
| `/soporte` | Tickets de Discord (admins y usuarios con permiso) |

## Subidas

`POST /api/uploads` solo acepta imágenes reales (PNG, JPG, GIF, WebP, AVIF; SVG solo para admins,
máximo 6 MB) y archivos comprimidos de skins; el tipo se decide por los bytes del archivo, no por el
nombre. Las subidas grandes de skins van directas a R2 con URL firmada (`/api/uploads/presign`).
Un usuario normal solo puede borrar lo que ha subido él o el logo/banner de un equipo o campeonato que gestiona.

## Tests y CI

`npm test` cubre el login de Steam, la validación de subidas, la limitación de ritmo y los helpers de
privacidad. GitHub Actions (`.github/workflows/ci.yml`) ejecuta `typecheck` y los tests en cada push.
