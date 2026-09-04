import { FileArchive, Trash2, Download } from 'lucide-react'
import { listCatalogFiles, type CatalogFile } from '@/lib/admin-catalog'
import { hasR2 } from '@/lib/r2'
import { CatalogUploader } from '@/components/catalog-uploader'
import { deleteCatalogFileAction } from '../actions'

function CatalogSection({ title, folder, files }: { title: string; folder: 'coches' | 'circuitos'; files: CatalogFile[] }) {
  return (
    <div className="space-y-3 rounded-lg border border-shell-line bg-black/20 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-white">{title}</h3>
      <CatalogUploader folder={folder} />
      <div className="space-y-1.5">
        {files.length === 0 ? (
          <p className="text-xs italic text-slate-500">Ningún archivo subido todavía.</p>
        ) : (
          files.map((file) => (
            <div key={file.key} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <FileArchive className="h-4 w-4 shrink-0 text-cyan-400" />
                <span className="truncate text-xs font-semibold text-slate-200" title={file.name}>{file.name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-white/10 p-1.5 text-slate-400 transition-colors hover:border-cyan-400 hover:text-cyan-300"
                  title="Descargar"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                <form action={deleteCatalogFileAction}>
                  <input type="hidden" name="url" value={file.url} />
                  <button
                    type="submit"
                    className="rounded-md border border-white/10 p-1.5 text-slate-400 transition-colors hover:border-rose-500 hover:text-rose-500"
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export async function AdminCatalogTab() {
  if (!hasR2) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5">
        <p className="text-xs text-slate-400">
          El almacenamiento R2 no está configurado en este entorno, así que el catálogo de coches y circuitos no está disponible.
        </p>
      </section>
    )
  }

  const [coches, circuitos] = await Promise.all([
    listCatalogFiles('coches'),
    listCatalogFiles('circuitos'),
  ])

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5">
      <div className="border-b border-shell-line pb-3">
        <h2 className="font-display-condensed text-sm font-bold uppercase tracking-wide text-white">Catálogo de contenido</h2>
        <p className="text-xs text-slate-400">Sube y gestiona los archivos ZIP de coches y circuitos disponibles en el servidor de almacenamiento.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CatalogSection title="Coches" folder="coches" files={coches} />
        <CatalogSection title="Circuitos" folder="circuitos" files={circuitos} />
      </div>
    </section>
  )
}
