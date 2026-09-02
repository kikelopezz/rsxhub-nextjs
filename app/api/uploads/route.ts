import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { getPlatformRole, getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { hasR2, uploadBufferToR2, deleteFromR2, listR2Objects, getR2KeyFromUrl } from '@/lib/r2'

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')
const BRANDING_DIR = path.join(process.cwd(), 'public', 'branding')

async function getUrlListSetting(key: string): Promise<string[]> {
  try {
    const setting = await db.setting.findUnique({ where: { key } })
    const urls = (setting?.value as any)?.urls
    return Array.isArray(urls) ? urls : []
  } catch (err) {
    console.error(`Failed to fetch setting "${key}":`, err)
    return []
  }
}

async function addUrlToSetting(key: string, url: string, prepend = false) {
  try {
    const existing = await getUrlListSetting(key)
    const urls = prepend ? Array.from(new Set([url, ...existing])) : Array.from(new Set([...existing, url]))
    await db.setting.upsert({ where: { key }, create: { key, value: { urls } }, update: { value: { urls } } })
  } catch (err) {
    console.error(`Failed to add url to setting "${key}":`, err)
  }
}

async function removeUrlFromSetting(key: string, url: string) {
  try {
    const existing = await getUrlListSetting(key)
    const urls = existing.filter((u) => u !== url)
    await db.setting.upsert({ where: { key }, create: { key, value: { urls } }, update: { value: { urls } } })
  } catch (err) {
    console.error(`Failed to remove url from setting "${key}":`, err)
  }
}

const getDeletedAssets = () => getUrlListSetting('deleted_assets')
const addDeletedAsset = (url: string) => addUrlToSetting('deleted_assets', url)
const removeDeletedAsset = (url: string) => removeUrlFromSetting('deleted_assets', url)

const getGalleryUploads = () => getUrlListSetting('gallery_uploads')
const addGalleryUpload = (url: string) => addUrlToSetting('gallery_uploads', url, true)
const removeGalleryUpload = (url: string) => removeUrlFromSetting('gallery_uploads', url)

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode')

    // Ensure uploads folder exists
    await fs.mkdir(UPLOADS_DIR, { recursive: true })

    const IMAGE_EXT = /\.(png|jpe?g|gif|svg|webp)$/i

    // Fetch explicit gallery uploads
    const galleryUploads = await getGalleryUploads()

    // Read branding assets (banners / system assets)
    let brandingImages: string[] = []
    try {
      const brandingFiles = await fs.readdir(BRANDING_DIR)
      brandingImages = brandingFiles
        .filter((f) => IMAGE_EXT.test(f))
        .map((f) => `/branding/${f}`)
    } catch {}

    let images: string[] = []
    if (mode === 'all') {
      let uploadImages: string[] = []
      if (hasR2) {
        uploadImages = (await listR2Objects('uploads/')).filter((url) => IMAGE_EXT.test(url))
      } else {
        const uploadFiles = await fs.readdir(UPLOADS_DIR)
        uploadImages = uploadFiles
          .filter((f) => IMAGE_EXT.test(f))
          .map((f) => `/uploads/${f}`)
      }
      images = Array.from(new Set([...galleryUploads, ...uploadImages, ...brandingImages]))
    } else {
      // ONLY explicit gallery uploads + branding system assets
      images = Array.from(new Set([...galleryUploads, ...brandingImages]))
    }

    // Filter out any assets that have been soft-deleted
    const deletedSet = new Set(await getDeletedAssets())
    const filteredImages = images.filter((img) => !deletedSet.has(img))

    return NextResponse.json({ images: filteredImages })
  } catch (err: any) {
    console.error('Failed to list uploads:', err)
    return NextResponse.json({ error: 'Failed to list uploads' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // Security check: Any logged-in user can upload files (e.g. for team logos)
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized: You must be logged in to upload files' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null

    const isGallery = formData.get('isGallery') === 'true' || type === 'gallery'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    // Sanitize filename
    const ext = path.extname(file.name)
    const nameWithoutExt = path.basename(file.name, ext)
    const safeBase = nameWithoutExt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')

    const isArchive = /\.(zip|rar|7z|tar|gz|tgz)$/i.test(file.name)

    // Compressed skin archives upload
    if (type === 'skin' || isArchive) {
      if (!isArchive) {
        return NextResponse.json(
          { error: 'Only compressed archive files (.zip, .rar, .7z, .tar.gz) are allowed.' },
          { status: 400 }
        )
      }

      // Max file size check for direct upload: 4.2MB (Vercel serverless body limit is 4.5MB)
      if (file.size > 4.2 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Skin file is larger than 4.2 MB (Vercel serverless upload limit). Please paste a Google Drive, Mega, or MediaFire download link instead.' },
          { status: 400 }
        )
      }

      const ext = path.extname(file.name)
      const rawBase = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_\-\.\s]/g, '_')
      const safeSkinName = `${rawBase}_${Date.now().toString(36)}${ext.toLowerCase()}`

      // 0. Prefer Cloudflare R2 when configured
      if (hasR2) {
        try {
          const finalUrl = await uploadBufferToR2(`skins/${safeSkinName}`, inputBuffer, file.type || 'application/zip')
          return NextResponse.json({ url: finalUrl, name: file.name })
        } catch (r2Err) {
          console.warn('Uploading skin to R2 failed, falling back to disk:', r2Err)
        }
      }

      const SKINS_DIR = path.join(process.cwd(), 'public', 'uploads', 'skins')
      const skinTargetPath = path.join(SKINS_DIR, safeSkinName)

      // 1. Attempt writing to public disk (Local / Dedicated Server)
      try {
        await fs.mkdir(SKINS_DIR, { recursive: true })
        await fs.writeFile(skinTargetPath, inputBuffer)
        const finalUrl = `/api/uploads/skins/${safeSkinName}`
        return NextResponse.json({ url: finalUrl, name: file.name })
      } catch (fsErr) {
        console.warn('Writing compressed skin to public disk failed. Trying /tmp storage:', fsErr)
      }

      // 2. Write to /tmp disk as a last resort (ephemeral — only survives within this request's lifetime).
      const TMP_SKINS_DIR = path.join('/tmp', 'skins')
      const tmpTargetPath = path.join(TMP_SKINS_DIR, safeSkinName)
      try {
        await fs.mkdir(TMP_SKINS_DIR, { recursive: true })
        await fs.writeFile(tmpTargetPath, inputBuffer)
        const finalUrl = `/api/uploads/skins/${safeSkinName}`
        return NextResponse.json({ url: finalUrl, name: file.name })
      } catch (tmpErr) {
        console.warn('Writing compressed skin to /tmp failed:', tmpErr)
      }

      return NextResponse.json(
        { error: 'Could not store skin file. Please paste a Google Drive, Mega, or MediaFire download link instead.' },
        { status: 500 }
      )
    }

    // Save the original file as-is (no compression/resizing/format conversion)
    const safeName = `${safeBase}${ext.toLowerCase()}`

    if (hasR2) {
      try {
        const finalUrl = await uploadBufferToR2(`uploads/${safeName}`, inputBuffer, file.type || 'application/octet-stream')
        await removeDeletedAsset(finalUrl)
        if (isGallery) {
          await addGalleryUpload(finalUrl)
        }
        return NextResponse.json({ url: finalUrl })
      } catch (r2Err) {
        console.warn('Uploading file to R2 failed, falling back to disk/Base64:', r2Err)
      }
    }

    const targetPath = path.join(UPLOADS_DIR, safeName)

    try {
      await fs.mkdir(UPLOADS_DIR, { recursive: true })
      await fs.writeFile(targetPath, inputBuffer)
      const finalUrl = `/uploads/${safeName}`
      await removeDeletedAsset(finalUrl)
      if (isGallery) {
        await addGalleryUpload(finalUrl)
      }
      return NextResponse.json({ url: finalUrl })
    } catch (fsErr) {
      console.warn('Writing original file to disk failed, falling back to base64:', fsErr)
      const mimeType = file.type || 'image/png'
      const base64 = inputBuffer.toString('base64')
      const finalUrl = `data:${mimeType};base64,${base64}`
      if (isGallery) {
        await addGalleryUpload(finalUrl)
      }
      return NextResponse.json({ url: finalUrl })
    }
  } catch (err: any) {
    console.error('Upload failed:', err)
    return NextResponse.json({ error: 'Failed to process uploaded file' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    // Security check: Only platform admins can delete assets
    const role = await getPlatformRole()
    if (role !== 'super_admin' && role !== 'platform_admin') {
      return NextResponse.json({ error: 'Unauthorized: Only platform admins can delete files' }, { status: 403 })
    }

    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
    }

    // Cloudflare R2-hosted asset
    const r2Key = getR2KeyFromUrl(url)
    if (r2Key) {
      try {
        await deleteFromR2(r2Key)
      } catch (r2Err) {
        console.warn('Deleting asset from R2 failed, soft-deleting instead:', r2Err)
      }
      await removeGalleryUpload(url)
      await addDeletedAsset(url)
      return NextResponse.json({ success: true })
    }

    // Sanitize path to prevent directory traversal
    const normalized = path.normalize(url).replace(/^(\.\.(\/|\\|$))+/, '')

    let targetPath = ''
    if (normalized.startsWith('/uploads/') || normalized.startsWith('uploads/')) {
      const fileName = path.basename(normalized)
      targetPath = path.join(UPLOADS_DIR, fileName)
    } else if (normalized.startsWith('/branding/') || normalized.startsWith('branding/')) {
      const fileName = path.basename(normalized)
      targetPath = path.join(BRANDING_DIR, fileName)
    } else {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }

    try {
      await fs.unlink(targetPath)
    } catch (unlinkErr: any) {
      console.warn('fs.unlink failed, falling back to soft delete:', unlinkErr)
      // Even if file deletion fails on read-only environments (Vercel, Git-tracked),
      // we still proceed with soft-deleting it from the list!
    }

    // Register in the soft-delete system and remove from gallery_uploads
    await removeGalleryUpload(url)
    await addDeletedAsset(url)

    return NextResponse.json({ success: true, softDeleted: true })
  } catch (err: any) {
    console.error('Delete failed:', err)
    return NextResponse.json({ error: `Failed to delete file: ${err.message || err}` }, { status: 500 })
  }
}
