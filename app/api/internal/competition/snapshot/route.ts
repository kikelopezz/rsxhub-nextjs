import { authorizeCompetitionRequest, buildSnapshot, json, publicBaseUrl } from '@/lib/competition-api'

export const dynamic = 'force-dynamic'

/** Campeonatos y eventos (ventana: ultimos 14 dias y proximos 90) con todo lo que necesita un consumidor. */
export async function GET(request: Request) {
  const denied = authorizeCompetitionRequest(request)
  if (denied) return denied
  try {
    return json(await buildSnapshot(publicBaseUrl(request)))
  } catch (error) {
    console.error('[competition-api] snapshot fallo:', error)
    return json({ error: 'No se pudo generar el snapshot.' }, { status: 500 })
  }
}
