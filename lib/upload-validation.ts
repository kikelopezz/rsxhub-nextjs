/**
 * Server-side validation for user uploads. The filename and `Content-Type` a browser sends are
 * attacker-controlled, so what a file *is* (and what extension / content type it is stored and
 * served with) is decided from its own bytes.
 */

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024
/** Skin archives that go through the server (R2 isn't configured / small files). */
export const MAX_SERVER_SKIN_BYTES = 4.2 * 1024 * 1024
/** Skin archives uploaded straight to R2 with a presigned URL. */
export const MAX_PRESIGNED_ARCHIVE_BYTES = 200 * 1024 * 1024
/** Request-body ceiling for POST /api/uploads, checked from Content-Length before parsing. */
export const MAX_UPLOAD_REQUEST_BYTES = 12 * 1024 * 1024

export type DetectedFile = { ext: string; contentType: string }

const startsWith = (buf: Buffer, bytes: number[], offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b)

const ascii = (buf: Buffer, start: number, end: number) => buf.subarray(start, end).toString('latin1')

/** png / jpeg / gif / webp / avif — recognised by magic bytes, nothing else is accepted. */
export function detectRasterImage(buf: Buffer): DetectedFile | null {
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: '.png', contentType: 'image/png' }
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { ext: '.jpg', contentType: 'image/jpeg' }
  if (ascii(buf, 0, 4) === 'GIF8') return { ext: '.gif', contentType: 'image/gif' }
  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WEBP') return { ext: '.webp', contentType: 'image/webp' }
  if (ascii(buf, 4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(buf, 8, 12))) return { ext: '.avif', contentType: 'image/avif' }
  return null
}

/** SVG can carry scripts, so callers must only allow it for trusted (platform admin) uploaders. */
export function detectSvg(buf: Buffer): DetectedFile | null {
  const head = buf.subarray(0, 2048).toString('utf8').trimStart().toLowerCase()
  const looksLikeSvg = head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))
  return looksLikeSvg ? { ext: '.svg', contentType: 'image/svg+xml' } : null
}

export const ARCHIVE_EXTENSIONS = ['zip', 'rar', '7z', 'tar', 'gz', 'tgz'] as const
export const ARCHIVE_NAME_PATTERN = /\.(zip|rar|7z|tar|gz|tgz)$/i

/** Content type an archive is stored/served with — chosen by us from its extension, never from the client. */
export function archiveContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || ''
  switch (ext) {
    case 'zip':
      return 'application/zip'
    case 'rar':
      return 'application/vnd.rar'
    case '7z':
      return 'application/x-7z-compressed'
    case 'tar':
      return 'application/x-tar'
    default:
      return 'application/gzip' // gz, tgz
  }
}

/** True when the bytes really are the archive type the extension claims. */
export function archiveMatchesExtension(buf: Buffer, filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop() || ''
  switch (ext) {
    case 'zip':
      return startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) || startsWith(buf, [0x50, 0x4b, 0x05, 0x06])
    case 'rar':
      return startsWith(buf, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])
    case '7z':
      return startsWith(buf, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])
    case 'gz':
    case 'tgz':
      return startsWith(buf, [0x1f, 0x8b])
    case 'tar':
      return ascii(buf, 257, 262) === 'ustar'
    default:
      return false
  }
}

/** Safe for a `Content-Disposition: filename="..."` value. */
export function safeHeaderFilename(name: string): string {
  return name.replace(/[^\w.\- ]/g, '_')
}
