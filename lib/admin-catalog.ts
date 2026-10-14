import { listR2Objects, getR2KeyFromUrl, hasR2 } from '@/lib/r2'

export type CatalogFolder = 'coches' | 'circuitos'

export type CatalogFile = {
  key: string
  url: string
  name: string
}

/**
 * Categorías del catálogo de coches/circuitos (una por campeonato): a qué subcarpeta de R2 va
 * cada subida y qué puede elegir el admin. Añadir un campeonato nuevo es añadir una línea aquí
 * — igual que SKIN_CATEGORIES en app/api/uploads/presign/route.ts para los skins de equipos.
 */
export const CATALOG_CATEGORIES = [
  { slug: 'erc', label: 'ERC' },
  { slug: 'erc-next-gen', label: 'ERC Next Gen' },
] as const

export type CatalogCategorySlug = (typeof CATALOG_CATEGORIES)[number]['slug']

// Uploaded keys look like "<folder>/<original-name>_<timestamp36>.<ext>" (see the presign
// route) — strip the generated suffix back off so the admin sees the file's real name.
function parseFileName(key: string): string {
  const base = key.split('/').pop() || key
  return base.replace(/_[0-9a-z]+(\.[a-z0-9.]+)$/i, '$1')
}

/**
 * Sin `category`, lista TODO lo que haya bajo ese folder (incluidas las subcarpetas de
 * categoría) — así listCarCatalogFilesAction() sigue viendo los coches de todas las categorías
 * para el selector de vehículos de equipos, sin tener que tocar ese código. Con `category`,
 * solo los archivos de esa subcarpeta — para las secciones del catálogo de admin.
 */
export async function listCatalogFiles(folder: CatalogFolder, category?: string): Promise<CatalogFile[]> {
  if (!hasR2) return []
  const prefix = category ? `${folder}/${category}/` : `${folder}/`
  const urls = await listR2Objects(prefix)
  return urls
    .map((url) => {
      const key = getR2KeyFromUrl(url) || url
      return { key, url, name: parseFileName(key) }
    })
    .reverse()
}

/** Archivos sueltos directamente en `folder/` (de antes de tener categorías), sin ninguna subcarpeta. */
export async function listUncategorizedCatalogFiles(folder: CatalogFolder): Promise<CatalogFile[]> {
  const all = await listCatalogFiles(folder)
  return all.filter((f) => !f.key.slice(`${folder}/`.length).includes('/'))
}
