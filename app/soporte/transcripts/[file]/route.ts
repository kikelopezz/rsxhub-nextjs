import { NextResponse } from 'next/server'
import { getTicketAccess } from '@/lib/ticket-access'
import { fetchTranscript, TicketApiError } from '@/lib/tickets-api'

export const dynamic = 'force-dynamic'

const FILE_NAME = /^ticket-[\w.-]+\.html$/

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const access = await getTicketAccess()
  if (!access.session || !access.canAccess) return new NextResponse('Forbidden', { status: 403 })

  const { file } = await params
  if (!FILE_NAME.test(file)) return new NextResponse('Not found', { status: 404 })

  try {
    const upstream = await fetchTranscript(file)
    if (!upstream.ok) return new NextResponse('Transcripción no encontrada', { status: 404 })

    // El HTML contiene mensajes de usuarios: se sirve aislado (sandbox) para que nunca pueda
    // ejecutar nada con la sesión del Hub. discord-html-transcripts dibuja los mensajes con
    // Web Components que carga desde jsdelivr (@derockdev/discord-components-core) — sin
    // permitir ESE script la página sale en blanco, así que el sandbox suelta scripts
    // (allow-scripts, sin allow-same-origin) y el CSP solo abre esa CDN, nunca el origen del Hub.
    // Mismo valor que next.config.ts fija para esta misma ruta — mantener ambos en sync.
    return new NextResponse(await upstream.text(), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy':
          "sandbox allow-scripts; default-src 'none'; script-src https://cdn.jsdelivr.net 'unsafe-inline'; style-src 'unsafe-inline' https://cdn.jsdelivr.net; img-src https: data:; font-src https: data: https://cdn.jsdelivr.net",
        'x-content-type-options': 'nosniff',
        'cache-control': 'private, no-store',
      },
    })
  } catch (e) {
    const message = e instanceof TicketApiError ? e.message : 'Error al obtener la transcripción'
    return new NextResponse(message, { status: 502 })
  }
}
