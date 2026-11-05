import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchWithTTLCache } from '@/lib/ttl-cache'

/**
 * Configuración (pública) del corte de alineaciones de la liga que usa este `source` de live
 * timing — vueltas mínimas y % sobre la mejor vuelta — para poder mostrarla en /live-timing.
 * Sin esto, un espectador solo ve la mejor vuelta real, no a partir de qué tiempo se considera
 * "fuera de corte" para la alineación de un equipo.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const source = searchParams.get('source') || ''
  if (!source) return NextResponse.json({ error: 'Missing source' }, { status: 400 })

  const config = await fetchWithTTLCache(
    `live_timing_cutoff_config_${source}`,
    async () => {
      const league = await db.league.findFirst({
        where: { liveTimingSource: source, deletedAt: null },
        select: { cutoffMinLaps: true, cutoffPercentOverBest: true },
      })
      return { minLaps: league?.cutoffMinLaps ?? null, cutoffPercent: league?.cutoffPercentOverBest ?? null }
    },
    60
  )

  return NextResponse.json(config, { headers: { 'Cache-Control': 'no-store' } })
}
