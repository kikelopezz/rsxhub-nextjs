/**
 * Script to compress all images in public/uploads and public/branding
 * Run with: node scripts/compress-images.mjs
 */
import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const DIRS = [
  path.join(ROOT, 'public', 'uploads'),
  path.join(ROOT, 'public', 'branding'),
  path.join(ROOT, 'public', 'carousel'),
]

const MAX_WIDTH = 1920  // max width, targets 1080p for widescreen banners
const MAX_HEIGHT = 1080
const JPEG_QUALITY = 78
const PNG_QUALITY = 80
const WEBP_QUALITY = 78

async function compressImage(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const stat = await fs.stat(filePath)
  const sizeBefore = stat.size

  // Skip tiny files < 50KB — not worth recompressing
  if (sizeBefore < 50 * 1024) {
    return null
  }

  let image = sharp(filePath).resize({ width: MAX_WIDTH, height: MAX_HEIGHT, fit: 'inside', withoutEnlargement: true })

  let buffer
  if (ext === '.jpg' || ext === '.jpeg') {
    buffer = await image.jpeg({ quality: JPEG_QUALITY, progressive: true, mozjpeg: true }).toBuffer()
  } else if (ext === '.png') {
    buffer = await image.png({ quality: PNG_QUALITY, compressionLevel: 9 }).toBuffer()
  } else if (ext === '.webp') {
    buffer = await image.webp({ quality: WEBP_QUALITY }).toBuffer()
  } else {
    return null // skip SVG, GIF, etc
  }

  // Only save if we actually reduced the size
  if (buffer.length < sizeBefore * 0.97) {
    await fs.writeFile(filePath, buffer)
    const saved = sizeBefore - buffer.length
    return { file: path.relative(ROOT, filePath), before: sizeBefore, after: buffer.length, saved }
  }

  return null
}

async function run() {
  let totalSaved = 0
  let totalFiles = 0

  for (const dir of DIRS) {
    let files
    try {
      files = await fs.readdir(dir)
    } catch {
      continue
    }

    for (const file of files) {
      if (!/\.(jpg|jpeg|png|webp)$/i.test(file)) continue
      const filePath = path.join(dir, file)
      try {
        const result = await compressImage(filePath)
        if (result) {
          totalSaved += result.saved
          totalFiles++
          console.log(`✓ ${result.file}: ${(result.before / 1024).toFixed(0)}KB → ${(result.after / 1024).toFixed(0)}KB (saved ${(result.saved / 1024).toFixed(0)}KB)`)
        } else {
          console.log(`– ${path.relative(ROOT, filePath)}: skipped (already small or no gain)`)
        }
      } catch (err) {
        console.error(`✗ ${file}: ${err.message}`)
      }
    }
  }

  console.log(`\n✅ Done! Compressed ${totalFiles} files, saved ${(totalSaved / 1024 / 1024).toFixed(2)} MB total`)
}

run()
