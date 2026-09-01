'use client'

/**
 * Uploads a skin archive file using a tiered strategy:
 * 0. Direct browser -> Cloudflare R2 upload via a presigned URL (no size limit from our server)
 * 1. Primary server endpoint (files <= 3.5 MB, used when R2 isn't configured)
 * 2. Catbox.moe direct upload (permanent, up to 200 MB)
 * 3. Litterbox fallback (72h temporary, up to 1 GB)
 *
 * Returns the final public URL, or null if all tiers failed.
 * Throws an Error if the file is not a valid archive or exceeds 200 MB.
 */
export async function uploadSkinFile(file: File): Promise<string | null> {
  const isArchive = /\.(zip|rar|7z|tar|gz|tgz)$/i.test(file.name)
  if (!isArchive) {
    throw new Error('Only compressed archive files (.zip, .rar, .7z, .tar.gz) are allowed.')
  }
  if (file.size > 200 * 1024 * 1024) {
    throw new Error('Skin file exceeds maximum allowed limit (200 MB).')
  }

  let finalSkinUrl: string | null = null

  // Tier 0: direct upload to R2 via presigned URL
  try {
    const presignRes = await fetch('/api/uploads/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/zip' }),
    })
    if (presignRes.ok) {
      const { uploadUrl, publicUrl } = await presignRes.json()
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/zip' },
        body: file,
      })
      if (putRes.ok) {
        finalSkinUrl = publicUrl
      }
    }
  } catch (r2Err) {
    console.warn('R2 presigned upload failed, falling back to server endpoint:', r2Err)
  }

  // Tier 1: server endpoint (small files, used when R2 isn't configured)
  if (!finalSkinUrl && file.size <= 3.5 * 1024 * 1024) {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'skin')
      const res = await fetch('/api/uploads', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        if (data.url) finalSkinUrl = data.url
      }
    } catch (serverErr) {
      console.warn('Primary server upload failed, falling back to Catbox:', serverErr)
    }
  }

  // Tier 2: Catbox (permanent, 200 MB)
  if (!finalSkinUrl) {
    try {
      const catboxData = new FormData()
      catboxData.append('reqtype', 'fileupload')
      catboxData.append('fileToUpload', file)
      const catboxRes = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: catboxData })
      if (catboxRes.ok) {
        const returnedUrl = await catboxRes.text()
        if (returnedUrl && returnedUrl.trim().startsWith('http')) {
          finalSkinUrl = returnedUrl.trim()
        }
      }
    } catch (catboxErr) {
      console.warn('Catbox upload failed, attempting Litterbox fallback:', catboxErr)
    }
  }

  // Tier 3: Litterbox fallback (72h, 1 GB)
  if (!finalSkinUrl) {
    try {
      const litterboxData = new FormData()
      litterboxData.append('reqtype', 'fileupload')
      litterboxData.append('time', '72h')
      litterboxData.append('fileToUpload', file)
      const lbRes = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
        method: 'POST',
        body: litterboxData,
      })
      if (lbRes.ok) {
        const returnedUrl = await lbRes.text()
        if (returnedUrl && returnedUrl.trim().startsWith('http')) {
          finalSkinUrl = returnedUrl.trim()
        }
      }
    } catch (lbErr) {
      console.warn('Litterbox upload failed:', lbErr)
    }
  }

  return finalSkinUrl
}
