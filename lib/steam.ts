const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login'
const STEAM_ID_PREFIX = 'https://steamcommunity.com/openid/id/'

export function buildSteamAuthUrl(request?: Request, clientOrigin?: string | null) {
  let realm = process.env.STEAM_REALM
  let returnTo = process.env.STEAM_RETURN_URL

  let baseUrl = ''

  if (clientOrigin) {
    baseUrl = clientOrigin
  }

  if (!baseUrl && request) {
    try {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
      const referer = request.headers.get('referer')

      if (forwardedHost) {
        baseUrl = `${forwardedProto}://${forwardedHost}`
      } else if (referer) {
        const refUrl = new URL(referer)
        baseUrl = `${refUrl.protocol}//${refUrl.host}`
      } else {
        const urlObj = new URL(request.url)
        baseUrl = `${urlObj.protocol}//${urlObj.host}`
      }
    } catch (err) {
      console.error('Error parsing request URL for dynamic Steam authentication config:', err)
    }
  }

  if (!baseUrl && process.env.APP_URL) {
    baseUrl = process.env.APP_URL
  }

  if (baseUrl) {
    baseUrl = baseUrl.replace(/\/+$/, '')
  }

  // If we are in a non-localhost environment, make sure we aren't using localhost for realm/returnTo
  const isRemote = baseUrl && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')
  const isEnvLocalhost = !realm || !returnTo || realm.includes('localhost') || returnTo.includes('localhost')

  if (isRemote || isEnvLocalhost) {
    if (baseUrl) {
      realm = `${baseUrl}/`
      returnTo = `${baseUrl}/api/auth/steam-callback`
    }
  }

  // Default fallbacks to prevent crashes
  if (!realm) {
    realm = 'http://localhost:3000/'
  }
  if (!returnTo) {
    returnTo = 'http://localhost:3000/api/auth/steam-callback'
  }

  // Ensure realm always ends with a trailing slash as required by Steam OpenID specification
  if (realm && !realm.endsWith('/')) {
    realm = `${realm}/`
  }

  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': realm,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  })

  return `${STEAM_OPENID_URL}?${params.toString()}`
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
  })

  const text = await response.text()
  return text.includes('is_valid:true')
}

export function extractSteamId(claimedId: string | null) {
  if (!claimedId) return null
  if (!claimedId.startsWith(STEAM_ID_PREFIX)) return null
  return claimedId.replace(STEAM_ID_PREFIX, '')
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
