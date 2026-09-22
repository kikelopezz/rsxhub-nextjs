import { authorizeCompetitionRequest, buildGrid, json } from '@/lib/competition-api'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const denied = authorizeCompetitionRequest(request)
  if (denied) return denied
  const { eventId } = await params
  try {
    const grid = await buildGrid(eventId)
    return grid ? json(grid) : json({ error: 'Evento no encontrado.' }, { status: 404 })
  } catch (error) {
    console.error('[competition-api] grid fallo:', error)
    return json({ error: 'No se pudo obtener la grid.' }, { status: 500 })
  }
}
