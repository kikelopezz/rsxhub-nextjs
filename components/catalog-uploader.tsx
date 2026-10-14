'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'

export function CatalogUploader({ folder }: { folder: string }) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleUpload = async (file: File) => {
    setUploading(true)
    setError('')
    try {
      const isArchive = /\.(zip|rar|7z|tar|gz|tgz)$/i.test(file.name)
      if (!isArchive) {
        throw new Error('Solo se permiten archivos comprimidos (.zip, .rar, .7z, .tar.gz).')
      }

      const presignRes = await fetch('/api/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, size: file.size, folder }),
      })
      if (!presignRes.ok) {
        const data = await presignRes.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo iniciar la subida.')
      }
      const { uploadUrl, publicUrl, contentType } = await presignRes.json()

      // Este PUT va directo al bucket de R2 (nunca pasa por nuestro servidor, necesario para
      // archivos de hasta 200 MB) — si el bucket no tiene el origen del sitio en su política
      // CORS, el navegador lo bloquea con un "Failed to fetch" genérico que no dice por qué.
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      }).catch(() => {
        throw new Error('No se pudo conectar con el almacenamiento (posible bloqueo de CORS en el bucket). Avisa a un admin técnico.')
      })
      if (!putRes.ok) throw new Error(`Fallo al subir el archivo (error ${putRes.status}).`)

      // The PUT went straight to R2, so the server hasn't checked the actual bytes yet —
      // confirm re-reads just the file header and deletes it if it isn't really an archive.
      const confirmRes = await fetch('/api/uploads/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicUrl }),
      })
      if (!confirmRes.ok) {
        const data = await confirmRes.json().catch(() => ({}))
        throw new Error(data.error || 'El archivo no es un comprimido válido.')
      }

      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Error al subir el archivo.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <label
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
          uploading
            ? 'border-cyan-500/50 bg-cyan-950/20 text-cyan-300'
            : 'border-amber-500/60 bg-amber-950/10 text-amber-300 hover:border-cyan-400 hover:text-white'
        }`}
      >
        <Upload className="h-4 w-4" />
        {uploading ? 'Subiendo...' : 'Subir archivo ZIP'}
        <input
          type="file"
          accept=".zip,.rar,.7z,.tar,.tar.gz,.gz"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleUpload(f)
            e.target.value = ''
          }}
        />
      </label>
      {/* Antes esto era un texto de 11px casi del mismo color que el fondo — un fallo real (403
          de permisos, CORS del bucket, archivo demasiado grande...) pasaba fácilmente desapercibido
          y el admin solo veía "no ha pasado nada". Ahora es un aviso que no se puede ignorar. */}
      {error && (
        <p className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-2.5 py-1.5 text-xs font-semibold text-rose-300">{error}</p>
      )}
    </div>
  )
}
