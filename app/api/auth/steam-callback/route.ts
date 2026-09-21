import { NextRequest, NextResponse } from 'next/server'
import {
  STEAM_STATE_COOKIE,
  checkSteamAssertion,
  extractSteamId,
  fetchSteamPlayerSummary,
  verifySteamResponse,
} from '@/lib/steam'
import { upsertUserFromSteam } from '@/lib/auth'

const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8' }

// The state cookie is single-use: whatever the outcome, it's cleared.
function htmlResponse(body: string) {
  const response = new NextResponse(body, { headers: HTML_HEADERS })
  response.cookies.set(STEAM_STATE_COOKIE, '', { path: '/api/auth', maxAge: 0 })
  return response
}

function failure(error: 'error' | 'invalid-steam', message: string) {
  return htmlResponse(
    `<html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_FAILURE', error: '${error}' }, window.location.origin);
              window.close();
            } else {
              window.location.href = '/?login=${error}';
            }
          </script>
          <p>${message}</p>
        </body>
      </html>`
  )
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  // Was this assertion issued for THIS site and THIS browser? (Steam alone can't tell us.)
  const expectedState = request.cookies.get(STEAM_STATE_COOKIE)?.value
  const assertion = checkSteamAssertion(searchParams, expectedState)
  if (!assertion.ok) {
    console.warn(`Rejected Steam login callback: ${assertion.reason}`)
    return failure('error', 'Error al iniciar sesión con Steam.')
  }

  let isValid = false
  try {
    isValid = await verifySteamResponse(searchParams)
  } catch (err) {
    console.error('Steam OpenID verification failed:', err)
  }
  if (!isValid) return failure('error', 'Error al iniciar sesión con Steam.')

  const steamId = extractSteamId(searchParams.get('openid.claimed_id'))
  if (!steamId) return failure('invalid-steam', 'ID de Steam inválido.')

  const summary = await fetchSteamPlayerSummary(steamId)

  const result = await upsertUserFromSteam({
    userId: '',
    steamId,
    steamDisplayName: summary.steamDisplayName,
    avatarUrl: summary.avatarUrl ?? undefined,
  })

  const isNew = !!result?.isNew

  return htmlResponse(
    `<html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', isNew: ${isNew} }, window.location.origin);
            window.close();
          } else {
            window.location.href = ${isNew ? "'/onboarding'" : "'/perfil'"};
          }
        </script>
        <p>Autenticación completada con éxito. Redirigiendo...</p>
      </body>
    </html>`
  )
}
