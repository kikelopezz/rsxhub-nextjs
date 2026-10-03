import { NextResponse } from 'next/server'
import path from 'path'
import { getCurrentUser, getAdminAccessContext } from '@/lib/auth'
import { hasR2, getR2ObjectPrefix, getR2KeyFromUrl, deleteFromR2 } from '@/lib/r2'
import { rateLimit } from '@/lib/rate-limit'
import { archiveMatchesExtension, detectRasterImage } from '@/lib/upload-validation'
import { isTrustedRequestOrigin } from '@/lib/csrf'

// A presigned PUT goes straight browser -> R2, so unlike POST /api/uploads (which checks the
// real magic bytes before writing anything) the server never sees the bytes at upload time. This
// closes that gap after the fact: the client calls here once the PUT succeeds, we read just
// enough of the object back to verify it really is the archive type its extension claims, and
// delete it if not — so a renamed non-archive can't sit behind a public R2 URL either way.
const ADMIN_ONLY_FOLDERS = ['coches', 'circuitos']

export async function POST(req: Request) {
  try {
    if (!isTrustedRequestOrigin(req)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasR2) {
      return NextResponse.json({ ok: false, error: 'R2 storage is not configured' }, { status: 501 })
    }

    if (!rateLimit(`upload-confirm:${currentUser.userId}`, 30, 10 * 60_000)) {
      return NextResponse.json({ ok: false, error: 'Demasiadas subidas seguidas. Espera unos minutos.' }, { status: 429 })
    }

    const { publicUrl } = await req.json()
    if (!publicUrl || typeof publicUrl !== 'string') {
      return NextResponse.json({ ok: false, error: 'No URL provided' }, { status: 400 })
    }

    const key = getR2KeyFromUrl(publicUrl)
    if (!key || key.includes('..')) {
      return NextResponse.json({ ok: false, error: 'Invalid file URL' }, { status: 400 })
    }

    const folder = key.split('/')[0]
    if (ADMIN_ONLY_FOLDERS.includes(folder)) {
      const access = await getAdminAccessContext(currentUser.userId)
      if (!access.canAccessPlatformAdmin) {
        return NextResponse.json({ ok: false, error: 'Forbidden: platform admins only' }, { status: 403 })
      }
    }

    const filename = path.basename(key)
    // 512 bytes covers every magic-byte / header check in archiveMatchesExtension (tar's is the
    // deepest, at offset 257-262).
    const prefix = await getR2ObjectPrefix(key, 512)

    if (folder === 'uploads') {
      if (!prefix || !detectRasterImage(prefix)) {
        if (prefix) await deleteFromR2(key)
        return NextResponse.json({ ok: false, error: 'El archivo no es una imagen válida.' }, { status: 400 })
      }
      return NextResponse.json({ ok: true })
    }

    if (!prefix || !archiveMatchesExtension(prefix, filename)) {
      if (prefix) await deleteFromR2(key)
      return NextResponse.json({ ok: false, error: 'El archivo no es un comprimido válido.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Failed to confirm presigned upload:', err)
    return NextResponse.json({ ok: false, error: 'Failed to confirm upload' }, { status: 500 })
  }
}
