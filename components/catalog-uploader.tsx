'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'

export function CatalogUploader({ folder }: { folder: 'coches' | 'circuitos' }) {
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
        body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/zip', folder }),
      })
      if (!presignRes.ok) {
        const data = await presignRes.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo iniciar la subida.')
      }
      const { uploadUrl } = await presignRes.json()

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/zip' },
        body: file,
      })
      if (!putRes.ok) throw new Error('Fallo al subir el archivo.')

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
          }}
        />
      </label>
      {error && <p className="text-[11px] font-semibold text-rose-400">{error}</p>}
    </div>
  )
}
