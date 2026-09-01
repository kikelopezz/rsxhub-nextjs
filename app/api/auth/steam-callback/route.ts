import { NextRequest, NextResponse } from 'next/server'
import { extractSteamId, fetchSteamPlayerSummary, verifySteamResponse } from '@/lib/steam'
import { upsertUserFromSteam } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const isValid = await verifySteamResponse(request.nextUrl.searchParams)

  if (!isValid) {
    return new NextResponse(
      `<html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_FAILURE', error: 'error' }, '*');
              window.close();
            } else {
              window.location.href = '/?login=error';
            }
          </script>
          <p>Error al iniciar sesión con Steam.</p>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  const claimedId = request.nextUrl.searchParams.get('openid.claimed_id')
  const steamId = extractSteamId(claimedId)

  if (!steamId) {
    return new NextResponse(
      `<html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_FAILURE', error: 'invalid-steam' }, '*');
              window.close();
            } else {
              window.location.href = '/?login=invalid-steam';
            }
          </script>
          <p>ID de Steam inválido.</p>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  const summary = await fetchSteamPlayerSummary(steamId)

  const result = await upsertUserFromSteam({
    userId: '',
    steamId,
    steamDisplayName: summary.steamDisplayName,
    avatarUrl: summary.avatarUrl ?? undefined,
  })

  const isNew = !!result?.isNew

  return new NextResponse(
    `<html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', isNew: ${isNew} }, '*');
            window.close();
          } else {
            window.location.href = ${isNew ? "'/onboarding'" : "'/perfil'"};
          }
        </script>
        <p>Autenticación completada con éxito. Redirigiendo...</p>
      </body>
    </html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}
