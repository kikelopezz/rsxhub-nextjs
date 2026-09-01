import { NextResponse } from 'next/server'
import path from 'path'
import { getCurrentUser } from '@/lib/auth'
import { hasR2, createPresignedUploadUrl, getR2PublicUrl } from '@/lib/r2'

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized: You must be logged in to upload files' }, { status: 401 })
    }

    if (!hasR2) {
      return NextResponse.json({ error: 'R2 storage is not configured' }, { status: 501 })
    }

    const { filename, contentType } = await req.json()
    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'No filename provided' }, { status: 400 })
    }

    const isArchive = /\.(zip|rar|7z|tar|gz|tgz)$/i.test(filename)
    if (!isArchive) {
      return NextResponse.json(
        { error: 'Only compressed archive files (.zip, .rar, .7z, .tar.gz) are allowed.' },
        { status: 400 }
      )
    }

    const ext = path.extname(filename)
    const rawBase = path.basename(filename, ext).replace(/[^a-zA-Z0-9_\-\.\s]/g, '_')
    const safeName = `${rawBase}_${Date.now().toString(36)}${ext.toLowerCase()}`
    const key = `skins/${safeName}`

    const uploadUrl = await createPresignedUploadUrl(key, contentType || 'application/zip')
    const publicUrl = getR2PublicUrl(key)

    return NextResponse.json({ uploadUrl, publicUrl })
  } catch (err: any) {
    console.error('Failed to create presigned upload URL:', err)
    return NextResponse.json({ error: 'Failed to create presigned upload URL' }, { status: 500 })
  }
}
