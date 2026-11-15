const ASSETTO_CORSA_APP_ID = 244210

/**
 * Horas jugadas en Assetto Corsa (Steam): null si no se puede saber (sin STEAM_WEB_API_KEY
 * configurada, o perfil/detalles de juego privados en Steam — Steam entonces no devuelve la
 * lista de juegos). Se usa para exigir un mínimo de horas por categoría al inscribirse
 * (ver CarCategory.minHours y app/admin/actions/admin-categories.ts).
 */
export async function getAssettoCorsaHours(steamId: string): Promise<number | null> {
  const key = process.env.STEAM_WEB_API_KEY
  if (!key || !steamId) return null
  try {
    const url = new URL('https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/')
    url.searchParams.set('key', key)
    url.searchParams.set('steamid', steamId)
    url.searchParams.set('include_played_free_games', '1')
    url.searchParams.set('appids_filter[0]', String(ASSETTO_CORSA_APP_ID))
    url.searchParams.set('format', 'json')
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return null
    const json = await res.json()
    const games = json?.response?.games as Array<{ appid: number; playtime_forever: number }> | undefined
    if (!Array.isArray(games)) return null
    const game = games.find((g) => g.appid === ASSETTO_CORSA_APP_ID)
    return Math.floor((game?.playtime_forever || 0) / 60)
  } catch {
    return null
  }
}
