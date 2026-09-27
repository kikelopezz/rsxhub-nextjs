import { NextResponse } from 'next/server'

/**
 * Redirección a una ruta del propio sitio con la cabecera Location relativa.
 *
 * Detrás del proxy inverso, `request.url` es la dirección interna del servidor (http://localhost:3000/…), así que
 * `NextResponse.redirect(new URL('/', request.url))` mandaba a los usuarios a localhost. Con una ruta relativa es el
 * navegador quien la resuelve contra la dirección pública que está usando.
 */
export function redirectTo(path: string, status: 301 | 302 | 303 | 307 | 308 = 307) {
  return new NextResponse(null, { status, headers: { Location: path } })
}
