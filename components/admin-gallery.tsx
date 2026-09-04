'use client'

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { Upload, Trash2, Copy, Download, Check, Loader2, Image as ImageIcon, HardDrive, X, Expand } from 'lucide-react'

type StorageStats = {
  backend: 'r2' | 'local'
  label: string
  usedBytes: number
  objectCount: number
  limitBytes: number
}

export function AdminGallery() {
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'uploads' | 'branding'>('all')
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchImages = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/uploads')
      if (res.ok) {
        const data = await res.json()
        setImages(data.images || [])
      }
    } catch (err) {
      console.error('Failed to load gallery images:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/storage-stats')
      if (res.ok) {
        setStats(await res.json())
      }
    } catch (err) {
      console.error('Failed to load storage stats:', err)
    }
  }

  useEffect(() => {
    fetchImages()
    fetchStats()
  }, [])

  const usedMB = stats ? Number((stats.usedBytes / (1024 * 1024)).toFixed(1)) : 0
  const limitMB = stats ? Math.round(stats.limitBytes / (1024 * 1024)) : 0
  const usagePercent = stats ? Math.min((stats.usedBytes / stats.limitBytes) * 100, 100) : 0

  const handleUpload = async (file: File) => {
    if (!file) return

    // Ensure it's an image
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido.')
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('isGallery', 'true')

    try {
      const res = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          setImages((prev) => {
            if (prev.includes(data.url)) return prev
            return [data.url, ...prev]
          })
          fetchStats()
        }
      } else {
        const errData = await res.json()
        alert(errData.error || 'No se pudo subir la imagen.')
      }
    } catch (err) {
      console.error('Upload error:', err)
      alert('Ocurrió un error al subir la imagen.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }

  const handleDelete = async (url: string) => {
    const fileName = url.split('/').pop()
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente la imagen "${fileName}"?`)) {
      return
    }

    try {
      const res = await fetch('/api/uploads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (res.ok) {
        setImages((prev) => prev.filter((img) => img !== url))
        fetchStats()
      } else {
        const data = await res.json()
        alert(data.error || 'No se pudo eliminar la imagen.')
      }
    } catch (err) {
      console.error('Delete error:', err)
      alert('Error al conectar con el servidor.')
    }
  }

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    setTimeout(() => setCopiedUrl(null), 2000)
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => {
    setDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUpload(file)
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const uploadsCount = images.filter((img) => img.startsWith('/uploads/')).length
  const brandingCount = images.filter((img) => img.startsWith('/branding/')).length

  const filteredImages = images.filter((img) => {
    if (filterType === 'uploads') return img.startsWith('/uploads/')
    if (filterType === 'branding') return img.startsWith('/branding/')
    return true
  })

  return (
    <div className="space-y-6">
      {/* Storage Usage Progress Bar */}
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-accent" />
            <span className="font-bold uppercase tracking-wider text-white">
              Almacenamiento {stats ? `(${stats.label})` : ''}
            </span>
          </div>
          {stats && (
            <div className="flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase border ${
                stats.backend === 'r2'
                  ? 'border-emerald-800/60 bg-emerald-950/60 text-emerald-300'
                  : 'border-amber-800/60 bg-amber-950/60 text-amber-300'
              }`}>
                {stats.backend === 'r2' ? '● R2 activo' : '● Modo local'}
              </span>
              <span className="font-mono font-bold text-accent">
                {usedMB} MB / {limitMB >= 1024 ? `${(limitMB / 1024).toFixed(0)} GB` : `${limitMB} MB`} ({usagePercent.toFixed(1)}% usado)
              </span>
            </div>
          )}
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded border border-slate-800 bg-slate-900">
          <div
            className="h-full bg-gradient-to-r from-[#1274de] via-cyan-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${Math.max(usagePercent, 2)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span>{stats ? `${stats.objectCount} archivos` : `${images.length} archivos multimedia guardados`}</span>
          <span>
            {stats?.backend === 'r2'
              ? 'Cloudflare R2 — nivel gratuito: 10 GB'
              : 'R2 no configurado: usando disco local (no persistente en serverless)'}
          </span>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        id="gallery-drop-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed p-8 text-center transition-colors cursor-pointer rounded-lg flex flex-col items-center justify-center min-h-[160px] ${
          dragging
            ? 'border-[#1274de] bg-[#1274de]/10 text-white'
            : 'border-shell-line bg-black/20 text-slate-400 hover:border-slate-500 hover:text-slate-200'
        }`}
        onClick={triggerFileInput}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />

        {uploading ? (
          <div className="space-y-2 flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#1274de]" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Subiendo imagen...</p>
          </div>
        ) : (
          <div className="space-y-2 flex flex-col items-center">
            <Upload className="h-8 w-8 text-slate-450" />
            <p className="text-sm font-semibold">Arrastra y suelta una imagen aquí, o haz clic para buscar</p>
            <p className="text-xxs text-slate-500 uppercase tracking-widest">Soporta PNG, JPG, WEBP</p>
          </div>
        )}
      </div>

      {/* Gallery Header and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-shell-line pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
            <ImageIcon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">
              Repositorio de imágenes <span className="text-slate-500 font-mono normal-case">({filteredImages.length})</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Administra los banners, logos y recursos gráficos de la plataforma.</p>
          </div>
        </div>

        <div className="flex border border-shell-line bg-black/40 p-1 rounded-lg w-fit text-xs gap-1">
          {([
            ['all', `Todas (${images.length})`],
            ['uploads', `Subidas (${uploadsCount})`],
            ['branding', `Sistema (${brandingCount})`],
          ] as const).map(([type, label]) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-1.5 font-bold uppercase tracking-wider transition-colors rounded-md cursor-pointer ${
                filterType === type
                  ? 'bg-[#1274de] text-white shadow-[0_0_16px_rgba(18,116,222,0.5)]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Gallery Grid */}
      {loading ? (
        <div className="py-12 text-center flex flex-col items-center justify-center space-y-2">
          <Loader2 className="h-6 w-6 animate-spin text-[#1274de]" />
          <p className="text-xs text-slate-400 font-medium">Cargando galería de imágenes...</p>
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="py-12 border border-shell-line bg-black/10 text-center rounded-lg flex flex-col items-center justify-center space-y-2">
          <ImageIcon className="h-8 w-8 text-slate-600" />
          <p className="text-xs text-slate-400 font-medium">No se encontraron imágenes en esta categoría.</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredImages.map((url) => {
            const fileName = url.split('/').pop() || ''
            const isBranding = url.startsWith('/branding/')

            return (
              <div
                key={url}
                className="group relative border border-shell-line bg-black/30 flex flex-col justify-between overflow-hidden rounded-lg hover:border-accent/40 transition-colors"
              >
                {/* Visual Preview */}
                <button
                  type="button"
                  onClick={() => setPreviewUrl(url)}
                  className="relative aspect-video w-full cursor-zoom-in overflow-hidden border-b border-shell-line bg-[repeating-conic-gradient(#111_0%_25%,#0a0a0a_0%_50%)] bg-[length:16px_16px]"
                >
                  <div className="absolute inset-3">
                    <Image
                      src={url}
                      alt={fileName}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-contain"
                    />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                    <Expand className="h-5 w-5 text-white" />
                  </div>
                  <span className={`absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded select-none ${
                    isBranding ? 'bg-amber-500/20 border border-amber-500/30 text-amber-200' : 'bg-blue-500/20 border border-blue-500/30 text-blue-200'
                  }`}>
                    {isBranding ? 'SISTEMA' : 'SUBIDA'}
                  </span>
                </button>

                {/* Details and Actions */}
                <div className="p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-300 truncate" title={fileName}>
                    {fileName}
                  </p>
                  <p className="text-xxs font-mono text-slate-500 truncate select-all">
                    {url}
                  </p>

                  <div className="grid grid-cols-3 gap-1 pt-1 border-t border-shell-line/40">
                    <button
                      onClick={() => handleCopy(url)}
                      title="Copiar ruta de imagen"
                      className="inline-flex justify-center items-center gap-1 p-1.5 border border-shell-line bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors rounded-lg cursor-pointer text-xxs font-bold uppercase tracking-wider"
                    >
                      {copiedUrl === url ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                    <a
                      href={url}
                      download={fileName}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Descargar o abrir"
                      className="inline-flex justify-center items-center gap-1 p-1.5 border border-shell-line bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors rounded-lg cursor-pointer text-xxs font-bold uppercase tracking-wider"
                    >
                      <Download className="h-3 w-3" />
                    </a>
                    <button
                      onClick={() => handleDelete(url)}
                      disabled={isBranding}
                      title={isBranding ? 'Las imágenes de branding del sistema no se pueden borrar' : 'Eliminar permanentemente'}
                      className={`inline-flex justify-center items-center gap-1 p-1.5 border transition-colors rounded-lg cursor-pointer text-xxs font-bold uppercase tracking-wider ${
                        isBranding
                          ? 'border-transparent text-slate-600 cursor-not-allowed opacity-30'
                          : 'border-red-500/20 bg-red-500/5 hover:bg-red-600/20 text-red-400 hover:text-red-300'
                      }`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Lightbox Preview */}
      {previewUrl && mounted && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-sm p-6"
              onClick={() => setPreviewUrl(null)}
            >
              <button
                type="button"
                onClick={() => setPreviewUrl(null)}
                className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-lg border border-shell-line bg-black/60 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="relative max-h-[85vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
                <img src={previewUrl} alt="" className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain" />
                <p className="mt-3 text-center font-mono text-xs text-slate-400 select-all">{previewUrl}</p>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
