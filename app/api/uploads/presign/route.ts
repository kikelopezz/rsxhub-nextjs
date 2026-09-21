import { NextResponse } from 'next/server'
import path from 'path'
import { getCurrentUser, getAdminAccessContext } from '@/lib/auth'
import { hasR2, createPresignedUploadUrl, getR2PublicUrl } from '@/lib/r2'
import { rateLimit } from '@/lib/rate-limit'
import { ARCHIVE_NAME_PATTERN, MAX_PRESIGNED_ARCHIVE_BYTES, archiveContentType } from '@/lib/upload-validation'

// coches/ and circuitos/ are the admin content catalog (platform_admin only). skins/ (flat,
// or skins/<category>/<league-slug> once a car's category+league are known) is where team
// managers upload their own car skins — any logged-in user may write there.
const ADMIN_ONLY_FOLDERS = ['coches', 'circuitos']
const SKIN_CATEGORIES = ['GT3', 'HYPERCAR', 'LMP2']

function resolveFolder(rawFolder: unknown): string | null {
  if (typeof rawFolder !== 'string') return 'skins'
  if (rawFolder === 'skins' || ADMIN_ONLY_FOLDERS.includes(rawFolder)) return rawFolder
  const skinsMatch = rawFolder.match(/^skins\/([A-Z0-9]+)\/([a-z0-9-]+)$/)
  if (skinsMatch && SKIN_CATEGORIES.includes(skinsMatch[1])) return rawFolder
  return null
}

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized: You must be logged in to upload files' }, { status: 401 })
    }

    if (!hasR2) {
      return NextResponse.json({ error: 'R2 storage is not configured' }, { status: 501 })
    }

    if (!rateLimit(`presign:${currentUser.userId}`, 30, 10 * 60_000)) {
      return NextResponse.json({ error: 'Demasiadas subidas seguidas. Espera unos minutos.' }, { status: 429 })
    }

    const { filename, folder: rawFolder, size } = await req.json()
    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'No filename provided' }, { status: 400 })
    }

    // Declared size: a presigned PUT can't be capped by the server, so at least refuse to hand out
    // an upload URL for something that is already announced as too big.
    if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: 'File size is required' }, { status: 400 })
    }
    if (size > MAX_PRESIGNED_ARCHIVE_BYTES) {
      return NextResponse.json({ error: 'Skin file exceeds maximum allowed limit (200 MB).' }, { status: 413 })
    }

    const folder = resolveFolder(rawFolder)
    if (!folder) {
      return NextResponse.json({ error: 'Invalid upload folder' }, { status: 400 })
    }

    if (ADMIN_ONLY_FOLDERS.includes(folder)) {
      const access = await getAdminAccessContext(currentUser.userId)
      if (!access.canAccessPlatformAdmin) {
        return NextResponse.json({ error: 'Forbidden: platform admins only' }, { status: 403 })
      }
    }

    const isArchive = ARCHIVE_NAME_PATTERN.test(filename)
    if (!isArchive) {
      return NextResponse.json(
        { error: 'Only compressed archive files (.zip, .rar, .7z, .tar.gz) are allowed.' },
        { status: 400 }
      )
    }

    const ext = path.extname(filename)
    const rawBase = path.basename(filename, ext).replace(/[^a-zA-Z0-9_\-\.\s]/g, '_')
    const safeName = `${rawBase}_${Date.now().toString(36)}${ext.toLowerCase()}`
    const key = `${folder}/${safeName}`

    // The stored Content-Type is ours (from the extension), not whatever the client claims —
    // it's part of the signature, so the browser must send exactly this one on the PUT.
    const contentType = archiveContentType(filename)
    const uploadUrl = await createPresignedUploadUrl(key, contentType)
    const publicUrl = getR2PublicUrl(key)

    return NextResponse.json({ uploadUrl, publicUrl, contentType })
  } catch (err: any) {
    console.error('Failed to create presigned upload URL:', err)
    return NextResponse.json({ error: 'Failed to create presigned upload URL' }, { status: 500 })
  }
}
