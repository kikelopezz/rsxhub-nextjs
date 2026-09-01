import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { getPlatformRole } from '@/lib/auth'
import { hasR2, getR2StorageStats } from '@/lib/r2'

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')
const LOCAL_SOFT_LIMIT_BYTES = 500 * 1024 * 1024 // Vercel/Git-tracked disk is only realistic up to a few hundred MB

async function getLocalDiskStats(): Promise<{ usedBytes: number; objectCount: number }> {
  let usedBytes = 0
  let objectCount = 0

  async function walk(dir: string) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else {
        try {
          const stat = await fs.stat(full)
          usedBytes += stat.size
          objectCount += 1
        } catch {}
      }
    }
  }

  await walk(UPLOADS_DIR)
  return { usedBytes, objectCount }
}

export async function GET() {
  try {
    const role = await getPlatformRole()
    if (role !== 'super_admin' && role !== 'platform_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (hasR2) {
      const { usedBytes, objectCount } = await getR2StorageStats()
      return NextResponse.json({
        backend: 'r2',
        label: 'Cloudflare R2',
        usedBytes,
        objectCount,
        limitBytes: 10 * 1024 * 1024 * 1024, // R2 free tier: 10 GB storage
      })
    }

    const { usedBytes, objectCount } = await getLocalDiskStats()
    return NextResponse.json({
      backend: 'local',
      label: 'Disco local (modo desarrollo, sin R2 configurado)',
      usedBytes,
      objectCount,
      limitBytes: LOCAL_SOFT_LIMIT_BYTES,
    })
  } catch (err: any) {
    console.error('Failed to compute storage stats:', err)
    return NextResponse.json({ error: 'Failed to compute storage stats' }, { status: 500 })
  }
}
