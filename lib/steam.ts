const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login'
const STEAM_ID_PREFIX = 'https://steamcommunity.com/openid/id/'
const OPENID_NS = 'http://specs.openid.net/auth/2.0'

export const STEAM_CALLBACK_PATH = '/api/auth/steam-callback'
export const STEAM_STATE_COOKIE = 'steam_login_state'

function originOf(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null
  } catch {
    return null
  }
}

/**
 * Origins this deployment accepts Steam logins on. `return_to` / `realm` used to be built from
 * whatever the request said (the `?origin=` query param, `Referer`, `X-Forwarded-Host`), so anyone
 * could send a victim to Steam with a `return_to` on a domain they control and then replay the
 * signed assertion against this site's callback. Now only these origins are ever used or accepted.
 *
 * Add the public domain to NEXT_PUBLIC_APP_URL (or list extra ones, comma-separated, in
 * ALLOWED_AUTH_ORIGINS). On Vercel the production/deployment URLs are included automatically.
 */
export function getTrustedOrigins(): Set<string> {
  const trusted = new Set<string>()
  const add = (value: string | null | undefined) => {
    const origin = originOf(value)
    if (origin) trusted.add(origin)
  }

  add(process.env.NEXT_PUBLIC_APP_URL)
  add(process.env.APP_URL)
  add(process.env.STEAM_REALM)
  add(process.env.STEAM_RETURN_URL)
  add(process.env.COMPETITION_PUBLIC_URL)
  for (const extra of (process.env.ALLOWED_AUTH_ORIGINS || '').split(',')) add(extra.trim())
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  if (process.env.VERCEL_URL) add(`https://${process.env.VERCEL_URL}`)
  if (process.env.NODE_ENV !== 'production') {
    add('http://localhost:3000')
    add('http://127.0.0.1:3000')
  }
  return trusted
}

/** The origin this request was served on, as far as the proxy in front tells us. Untrusted input. */
function requestOrigin(request?: Request): string | null {
  if (!request) return null
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  if (forwardedHost) {
    const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https'
    return originOf(`${proto}://${forwardedHost}`)
  }
  return originOf(request.url)
}

export function buildSteamAuthUrl(request: Request | undefined, clientOrigin: string | null | undefined, state: string) {
  const trusted = getTrustedOrigins()

  // Candidates are only ever *hints*: one is used only if it is on the allow-list.
  const base =
    [originOf(clientOrigin), requestOrigin(request)].find((candidate): candidate is string => !!candidate && trusted.has(candidate)) ??
    originOf(process.env.STEAM_RETURN_URL) ??
    originOf(process.env.STEAM_REALM) ??
    originOf(process.env.NEXT_PUBLIC_APP_URL) ??
    (process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : null)

  if (!base) {
    throw new Error('Steam login is not configured: set NEXT_PUBLIC_APP_URL (or STEAM_REALM / STEAM_RETURN_URL).')
  }

  const returnTo = `${base}${STEAM_CALLBACK_PATH}?${new URLSearchParams({ state }).toString()}`

  const params = new URLSearchParams({
    'openid.ns': OPENID_NS,
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': `${base}/`,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  })

  return `${STEAM_OPENID_URL}?${params.toString()}`
}

const REQUIRED_SIGNED_FIELDS = ['op_endpoint', 'claimed_id', 'identity', 'return_to', 'response_nonce']

/**
 * Local checks that must pass *before* asking Steam to verify the signature. Steam only
 * checks that the assertion was really issued; it does not know which site it was meant for, so
 * it is on us to make sure it was issued for THIS site (`return_to`) and for THIS browser (`state`).
 */
export function checkSteamAssertion(
  searchParams: URLSearchParams,
  expectedState: string | null | undefined
): { ok: true } | { ok: false; reason: string } {
  const get = (key: string) => searchParams.get(`openid.${key}`)

  if (get('ns') !== OPENID_NS) return { ok: false, reason: 'bad-namespace' }
  if (get('mode') !== 'id_res') return { ok: false, reason: 'bad-mode' }
  if (get('op_endpoint') !== STEAM_OPENID_URL) return { ok: false, reason: 'bad-endpoint' }

  const claimedId = get('claimed_id')
  if (!claimedId || claimedId !== get('identity') || !extractSteamId(claimedId)) return { ok: false, reason: 'bad-identity' }

  const signed = (get('signed') || '').split(',')
  if (!REQUIRED_SIGNED_FIELDS.every((field) => signed.includes(field))) return { ok: false, reason: 'unsigned-fields' }

  let returnTo: URL
  try {
    returnTo = new URL(get('return_to') || '')
  } catch {
    return { ok: false, reason: 'bad-return-to' }
  }
  if (!getTrustedOrigins().has(returnTo.origin) || returnTo.pathname !== STEAM_CALLBACK_PATH) {
    return { ok: false, reason: 'untrusted-return-to' }
  }

  const state = returnTo.searchParams.get('state')
  if (!expectedState || !state || state !== expectedState) return { ok: false, reason: 'state-mismatch' }

  return { ok: true }
}

export async function verifySteamResponse(searchParams: URLSearchParams) {
  const validationParams = new URLSearchParams(searchParams)
  validationParams.set('openid.mode', 'check_authentication')

  const response = await fetch(STEAM_OPENID_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: validationParams.toString(),
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) return false

  const text = await response.text()
  return text.split('\n').some((line) => line.trim() === 'is_valid:true')
}

export function extractSteamId(claimedId: string | null) {
  if (!claimedId) return null
  if (!claimedId.startsWith(STEAM_ID_PREFIX)) return null
  const steamId = claimedId.slice(STEAM_ID_PREFIX.length)
  return /^\d{17}$/.test(steamId) ? steamId : null
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
}

export async function fetchSteamPlayerSummary(steamId: string) {
  const key = process.env.STEAM_WEB_API_KEY
  if (!key) {
    // 1. Try XML approach with custom browser headers first
    try {
      const response = await fetch(`https://steamcommunity.com/profiles/${steamId}/?xml=1`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/xml,application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5',
          'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        cache: 'no-store',
      })
      if (response.ok) {
        const text = await response.text()
        const steamIDMatch = text.match(/<steamID><!\[CDATA\[([\s\S]*?)\]\]><\/steamID>/i) || text.match(/<steamID>([\s\S]*?)<\/steamID>/i)
        const avatarFullMatch = text.match(/<avatarFull><!\[CDATA\[([\s\S]*?)\]\]><\/avatarFull>/i) || text.match(/<avatarFull>([\s\S]*?)<\/avatarFull>/i)
        const profileUrlMatch = text.match(/<customURL><!\[CDATA\[([\s\S]*?)\]\]><\/customURL>/i) || text.match(/<customURL>([\s\S]*?)<\/customURL>/i)

        if (steamIDMatch) {
          const rawDisplayName = steamIDMatch[1].trim()
          const steamDisplayName = decodeXmlEntities(rawDisplayName)
          const avatarUrl = avatarFullMatch ? avatarFullMatch[1].trim() : null
          const profileUrl = profileUrlMatch 
            ? `https://steamcommunity.com/id/${profileUrlMatch[1].trim()}` 
            : `https://steamcommunity.com/profiles/${steamId}`

          if (steamDisplayName && !steamDisplayName.startsWith('Steam User')) {
            return {
              steamDisplayName,
              avatarUrl,
              profileUrl,
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch Steam public XML profile:', err)
    }

    // 2. Try HTML scraping approach as a powerful fallback (meta/title tags are always public)
    try {
      const response = await fetch(`https://steamcommunity.com/profiles/${steamId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        cache: 'no-store',
      })
      if (response.ok) {
        const htmlText = await response.text()
        
        let steamDisplayName = ''
        
        // Match from meta tag <meta property="og:title" content="..." />
        const ogTitleMatch = htmlText.match(/<meta\s+property="og:title"\s+content="Steam\s+Community\s+::\s+([^"]+)"/i) || 
                             htmlText.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)
        if (ogTitleMatch) {
          let titleVal = ogTitleMatch[1].trim()
          if (titleVal.startsWith('Steam Community :: ')) {
            titleVal = titleVal.replace('Steam Community :: ', '')
          }
          if (titleVal && !titleVal.toLowerCase().includes('steam community')) {
            steamDisplayName = decodeXmlEntities(titleVal)
          }
        }

        // Match from <title> tag of form "<title>Steam Community :: [Name]</title>"
        if (!steamDisplayName) {
          const titleTagMatch = htmlText.match(/<title>Steam\s+Community\s+::\s+([\s\S]*?)<\/title>/i)
          if (titleTagMatch && titleTagMatch[1].trim()) {
            steamDisplayName = decodeXmlEntities(titleTagMatch[1].trim())
          }
        }

        // Match from span class "actual_persona_name"
        if (!steamDisplayName) {
          const personaNameMatch = htmlText.match(/<span\s+class="actual_persona_name">([\s\S]*?)<\/span>/i)
          if (personaNameMatch && personaNameMatch[1].trim()) {
            steamDisplayName = decodeXmlEntities(personaNameMatch[1].trim())
          }
        }

        // Extract avatar from <meta property="og:image" content="..." />
        const ogImageMatch = htmlText.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
        const linkImageMatch = htmlText.match(/<link\s+rel="image_src"\s+href="([^"]+)"/i)
        const avatarUrl = ogImageMatch ? ogImageMatch[1].trim() : (linkImageMatch ? linkImageMatch[1].trim() : null)

        if (steamDisplayName) {
          return {
            steamDisplayName,
            avatarUrl,
            profileUrl: `https://steamcommunity.com/profiles/${steamId}`,
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch Steam HTML profile:', err)
    }

    return {
      steamDisplayName: `Steam User ${steamId.slice(-4)}`,
      avatarUrl: null,
      profileUrl: `https://steamcommunity.com/profiles/${steamId}`,
    }
  }

  const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/')
  url.searchParams.set('key', key)
  url.searchParams.set('steamids', steamId)

  const response = await fetch(url.toString(), { cache: 'no-store' })
  const json = await response.json()
  const player = json?.response?.players?.[0]

  return {
    steamDisplayName: player?.personaname ?? `Steam User ${steamId.slice(-4)}`,
    avatarUrl: player?.avatarfull ?? null,
    profileUrl: player?.profileurl ?? `https://steamcommunity.com/profiles/${steamId}`,
  }
}
