import { authorizeCompetitionRequest, buildLiveSummary, json } from '@/lib/competition-api'

export const dynamic = 'force-dynamic'

/** Resumen compacto del live timing: /live?source=erc&server=1 */
export async function GET(request: Request) {
  const denied = authorizeCompetitionRequest(request)
  if (denied) return denied
  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source') || 'erc'
  const server = Number(searchParams.get('server') || '0')
  if (!Number.isInteger(server) || server < 0 || server > 9) return json({ error: 'server no valido.' }, { status: 400 })

  try {
    const summary = await buildLiveSummary(source, server)
    if ('error' in summary) return json(summary, { status: 404 })
    return json(summary)
  } catch (error) {
    console.error('[competition-api] live fallo:', error)
    return json({ error: 'No se pudo alcanzar el live timing.' }, { status: 502 })
  }
}
