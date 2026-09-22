import { authorizeCompetitionRequest, buildResults, json } from '@/lib/competition-api'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const denied = authorizeCompetitionRequest(request)
  if (denied) return denied
  const { eventId } = await params
  try {
    const results = await buildResults(eventId)
    return results ? json(results) : json({ error: 'Evento no encontrado.' }, { status: 404 })
  } catch (error) {
    console.error('[competition-api] results fallo:', error)
    return json({ error: 'No se pudieron obtener los resultados.' }, { status: 500 })
  }
}
