import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Un nonce distinto en cada petición. Se manda tanto en la cabecera CSP (script-src) como en
  // una cabecera de petición (x-nonce) que el layout raíz lee con headers() para poder ponerlo
  // también en los <script> que no genera el propio Next.js (p. ej. el JSON-LD del SEO).
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic' es necesario para que los scripts que el propio Next.js carga en tiempo
    // de ejecución (code-splitting de webpack) hereden la confianza del script que los cargó, sin
    // necesitar su propio nonce — así lo recomienda la propia guía de CSP de Next.js.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Los estilos en línea (style={{...}} de React) no llevan nonce factible uno a uno; el riesgo
    // de solo-CSS es mucho menor que el de script-src.
    "style-src 'self' 'unsafe-inline'",
    // blob: hace falta para el modal de "ajustar imagen" (components/image-picker.tsx): tanto al
    // elegir un archivo nuevo como al reajustar uno ya subido, la vista previa se carga desde una
    // URL creada con URL.createObjectURL(), que el navegador sirve con el esquema blob:. Sin esto
    // en la whitelist, la CSP bloquea esa carga y el modal muestra "No se pudo cargar la imagen."
    // aunque el archivo/blob en sí sea perfectamente válido.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // Subida directa navegador→R2 (URL prefirmada) y los dos niveles de respaldo sin R2 configurado.
    "connect-src 'self' https://*.r2.cloudflarestorage.com https://catbox.moe https://litterbox.catbox.moe",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    // Todo excepto los propios archivos internos de Next y /api/**. Las rutas de API no las
    // renderiza React (el nonce no pinta nada ahí) y una de ellas — el callback de login de
    // Steam — manda sus propios <script> de un popup sin pasar por el pipeline de páginas.
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
