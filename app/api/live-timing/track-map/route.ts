import { NextResponse } from 'next/server'

/**
 * Mapa oficial del circuito, tomado del propio servidor de carrera (Assetto Corsa Server Manager):
 *   - kind=image → map.png del circuito
 *   - kind=meta  → parámetros de map.ini para pasar las coordenadas del juego a píxeles del mapa
 * Se sirve a través de esta ruta para no depender de CORS ni del dominio del servidor en el navegador.
 */

const SOURCE_URLS: Record<string, string> = {
  erc: process.env.NEXT_PUBLIC_LIVE_TIMING_API_URL || '',
  'erc-next-gen': process.env.NEXT_PUBLIC_LIVE_TIMING_API_URL_ERC_NEXT_GEN || '',
}

// Solo carpetas del contenido del juego: nada de barras ni "..", para no poder pedir otras rutas del servidor
const SAFE_SEGMENT = /^[A-Za-z0-9_.\- ]{1,120}$/
const isSafe = (value: string) => SAFE_SEGMENT.test(value) && !value.includes('..')

function parseIni(text: string) {
  const values: Record<string, number> = {}
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(-?[\d.eE+-]+)\s*$/)
    if (match) values[match[1]] = Number(match[2])
  }
  return values
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const source = searchParams.get('source') || 'erc'
  const track = searchParams.get('track') || ''
  const config = searchParams.get('config') || ''
  const kind = searchParams.get('kind') === 'meta' ? 'meta' : 'image'

  const sourceUrl = SOURCE_URLS[source]
  if (!sourceUrl) return NextResponse.json({ error: 'Source not configured' }, { status: 500 })
  if (!track || !isSafe(track) || (config && !isSafe(config))) return NextResponse.json({ error: 'Invalid track' }, { status: 400 })

  const base = `${new URL(sourceUrl).origin}/content/tracks/${encodeURIComponent(track)}${config ? `/${encodeURIComponent(config)}` : ''}`
  const target = kind === 'meta' ? `${base}/data/map.ini` : `${base}/map.png`

  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(10_000), next: { revalidate: 86_400 } })
    if (!res.ok) return NextResponse.json({ error: 'Map not available' }, { status: 404 })

    if (kind === 'meta') {
      const ini = parseIni(await res.text())
      const { WIDTH, HEIGHT, SCALE_FACTOR, X_OFFSET, Z_OFFSET } = ini
      if (![WIDTH, HEIGHT, SCALE_FACTOR, X_OFFSET, Z_OFFSET].every((n) => Number.isFinite(n)) || !SCALE_FACTOR) {
        return NextResponse.json({ error: 'Invalid map.ini' }, { status: 404 })
      }
      return NextResponse.json(
        { width: WIDTH, height: HEIGHT, scale: SCALE_FACTOR, offsetX: X_OFFSET, offsetZ: Z_OFFSET, padding: ini.PADDING ?? 0 },
        { headers: { 'Cache-Control': 'public, max-age=86400' } }
      )
    }

    return new NextResponse(await res.arrayBuffer(), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400, immutable' },
    })
  } catch {
    return NextResponse.json({ error: 'Map unavailable' }, { status: 502 })
  }
}
