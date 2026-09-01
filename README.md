# SimLeague Platform

Starter para una plataforma estilo SimGrid orientada a Assetto Corsa y Le Mans Ultimate.

## Que incluye
- Home
- Explorador de ligas
- Calendario
- Detalle de liga
- Login con Steam
- Perfil basico
- Registro a ligas
- Panel admin global y por liga
- Roles de plataforma y roles por liga
- Preparacion para Supabase

## Instalacion

```bash
npm install
npm run dev
```

## Variables de entorno minimas
Crea un `.env.local` basandote en `.env.local.example`.

Para modo demo puedes arrancar solo con:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
SESSION_SECRET=un_secreto_largo
STEAM_REALM=http://localhost:3000
STEAM_RETURN_URL=http://localhost:3000/api/auth/steam-callback
```

## Modo demo vs modo real
- Sin Supabase: navegas y ves paneles, pero no hay persistencia.
- Con Supabase: ligas, eventos, inscripciones y roles se guardan.

## Sistema de roles

### Plataforma
- `super_admin`
- `platform_admin`
- `user`

### Liga
- `league_owner`
- `league_admin`
- `steward`
- `team_manager`
- `driver`

## Circuitos con imagen

- Hay un catalogo predefinido de circuitos con imagen.
- Las imagenes locales viven en `public/circuits/`.
- Al crear evento puedes:
  - elegir un circuito existente del catalogo
  - crear un circuito personalizado con nombre + imagen (se guarda en BD)
- Los circuitos personalizados se guardan en la tabla `circuits` y luego aparecen para reutilizar.

## Bootstrap de administradores

Puedes usar `ADMIN_STEAM_IDS` para bootstrap rapido de `super_admin` durante desarrollo.
Si esta variable esta vacia, el acceso se resuelve solo por tablas de roles en base de datos.

## Supabase
1. Crea proyecto en Supabase.
2. Ejecuta `sql/phase1_schema.sql`.
3. Ejecuta `sql/phase2_roles.sql`.
4. Anade `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`.

## Paneles incluidos
- `/admin` -> panel global o panel de ligas asignadas segun permisos
- `/admin/ligas/[id]` -> eventos e inscripciones de una liga
- `/admin/ligas/[id]/miembros` -> gestion de miembros y roles por SteamID
