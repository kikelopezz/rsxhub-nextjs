import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { getFirestoreDb, hasFirebase } from '@/lib/firebase'

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
      const mime = filename.endsWith('.rar') ? 'application/x-rar-compressed' : 'application/zip'
      return new Response(buffer, {
        headers: {
          'Content-Type': mime,
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } catch {}

    // 2. Try /tmp directory (Vercel serverless writable storage)
    const tmpPath = path.join('/tmp', 'skins', filename)
    try {
      const buffer = await fs.readFile(tmpPath)
      const mime = filename.endsWith('.rar') ? 'application/x-rar-compressed' : 'application/zip'
      return new Response(buffer, {
        headers: {
          'Content-Type': mime,
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } catch {}

    // 3. Try Firestore skin_files collection chunks
    if (hasFirebase) {
      const db = getFirestoreDb()
      if (db) {
        try {
          const doc = await db.collection('skin_files').doc(filename).get()
          if (doc.exists) {
            const data = doc.data()
            if (data?.base64Data) {
              const buffer = Buffer.from(data.base64Data, 'base64')
              return new Response(buffer, {
                headers: {
                  'Content-Type': data.mimeType || 'application/zip',
                  'Content-Disposition': `attachment; filename="${data.name || filename}"`,
                },
              })
            }

            // Check if chunked
            if (data?.chunkCount && Number(data.chunkCount) > 0) {
              const total = Number(data.chunkCount)
              const buffers: Buffer[] = []
              for (let i = 0; i < total; i++) {
                const chunkDoc = await db.collection('skin_files').doc(`${filename}_chunk_${i}`).get()
                if (chunkDoc.exists && chunkDoc.data()?.base64) {
                  buffers.push(Buffer.from(chunkDoc.data()?.base64, 'base64'))
                }
              }
              if (buffers.length === total) {
                const combined = Buffer.concat(buffers)
                return new Response(combined, {
                  headers: {
                    'Content-Type': data.mimeType || 'application/zip',
                    'Content-Disposition': `attachment; filename="${data.name || filename}"`,
                  },
                })
              }
            }
          }
        } catch (dbErr) {
          console.error('Failed to read skin file from Firestore:', dbErr)
        }
      }
    }

    return NextResponse.json({ error: 'Skin file not found' }, { status: 404 })
  } catch (err: any) {
    console.error('Error serving skin file:', err)
    return NextResponse.json({ error: 'Failed to retrieve skin file' }, { status: 500 })
  }
}
