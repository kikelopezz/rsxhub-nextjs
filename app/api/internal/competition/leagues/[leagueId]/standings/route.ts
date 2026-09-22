import { authorizeCompetitionRequest, buildStandings, json } from '@/lib/competition-api'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const denied = authorizeCompetitionRequest(request)
  if (denied) return denied
  const { leagueId } = await params
  try {
    const standings = await buildStandings(leagueId)
    return standings ? json(standings) : json({ error: 'Campeonato no encontrado.' }, { status: 404 })
  } catch (error) {
    console.error('[competition-api] standings fallo:', error)
    return json({ error: 'No se pudo obtener la clasificacion.' }, { status: 500 })
  }
}
