import { listR2Objects, getR2KeyFromUrl, hasR2 } from '@/lib/r2'

export type CatalogFolder = 'coches' | 'circuitos'

export type CatalogFile = {
  key: string
  url: string
  name: string
}

// Uploaded keys look like "<folder>/<original-name>_<timestamp36>.<ext>" (see the presign
// route) — strip the generated suffix back off so the admin sees the file's real name.
function parseFileName(key: string): string {
  const base = key.split('/').pop() || key
  return base.replace(/_[0-9a-z]+(\.[a-z0-9.]+)$/i, '$1')
}

export async function listCatalogFiles(folder: CatalogFolder): Promise<CatalogFile[]> {
  if (!hasR2) return []
  const urls = await listR2Objects(`${folder}/`)
  return urls
    .map((url) => {
      const key = getR2KeyFromUrl(url) || url
      return { key, url, name: parseFileName(key) }
    })
    .reverse()
}
