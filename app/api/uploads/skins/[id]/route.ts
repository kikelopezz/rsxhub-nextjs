import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { archiveContentType, safeHeaderFilename } from '@/lib/upload-validation'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const filename = path.basename(id)

    // 1. Try public uploads directory
    const publicPath = path.join(process.cwd(), 'public', 'uploads', 'skins', filename)
    try {
      const buffer = await fs.readFile(publicPath)
      const mime = archiveContentType(filename)
      return new Response(buffer, {
        headers: {
          'Content-Type': mime,
          'Content-Disposition': `attachment; filename="${safeHeaderFilename(filename)}"`,
          'X-Content-Type-Options': 'nosniff',
        },
      })
    } catch {}

    // 2. Try /tmp directory (ephemeral serverless writable storage)
    const tmpPath = path.join('/tmp', 'skins', filename)
    try {
      const buffer = await fs.readFile(tmpPath)
      const mime = archiveContentType(filename)
      return new Response(buffer, {
        headers: {
          'Content-Type': mime,
          'Content-Disposition': `attachment; filename="${safeHeaderFilename(filename)}"`,
          'X-Content-Type-Options': 'nosniff',
        },
      })
    } catch {}

    return NextResponse.json({ error: 'Skin file not found' }, { status: 404 })
  } catch (err: any) {
    console.error('Error serving skin file:', err)
    return NextResponse.json({ error: 'Failed to retrieve skin file' }, { status: 500 })
  }
}
