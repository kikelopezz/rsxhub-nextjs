'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { Upload, Check, Loader2, Trash2, Move, X } from 'lucide-react'

interface ImagePickerProps {
  name: string
  defaultValue?: string
  label?: string
  hideGallery?: boolean
  onChange?: (value: string) => void
  /** Team or league name used to build a stable, collision-free filename (e.g. "[name]-logo"). */
  entityName?: string
}

const FRAME_W = 720
const FRAME_H = 240 // 3:1, matches the preview box aspect ratio below

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/** Drag-to-reposition modal: shows the image "cover"-fit inside a fixed frame and
 *  lets the user pan it, then bakes the visible crop into a new image blob. */
function RepositionModal({
  imageSrc,
  onCancel,
  onConfirm,
}: {
  imageSrc: string
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [ready, setReady] = useState(false)
  const [coverScale, setCoverScale] = useState(1)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragState = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null)
  const [baking, setBaking] = useState(false)

  const handleImgLoad = () => {
    const img = imgRef.current
    if (!img) return
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    const scale = Math.max(FRAME_W / iw, FRAME_H / ih)
    const dw = iw * scale
    const dh = ih * scale
    setNatural({ w: iw, h: ih })
    setCoverScale(scale)
    setOffset({ x: (FRAME_W - dw) / 2, y: (FRAME_H - dh) / 2 })
    setReady(true)
  }

  const clampOffset = useCallback(
    (x: number, y: number) => {
      const dw = natural.w * coverScale
      const dh = natural.h * coverScale
      return {
        x: clamp(x, FRAME_W - dw, 0),
        y: clamp(y, FRAME_H - dh, 0),
      }
    },
    [natural, coverScale]
  )

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragState.current = { startX: e.clientX, startY: e.clientY, offsetX: offset.x, offsetY: offset.y }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    setOffset(clampOffset(dragState.current.offsetX + dx, dragState.current.offsetY + dy))
  }

  const handlePointerUp = () => {
    dragState.current = null
  }

  const handleConfirm = async () => {
    const img = imgRef.current
    if (!img) return
    setBaking(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = FRAME_W * 2
      canvas.height = FRAME_H * 2
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas not supported')
      const sx = -offset.x / coverScale
      const sy = -offset.y / coverScale
      const sw = FRAME_W / coverScale
      const sh = FRAME_H / coverScale
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          setBaking(false)
          if (blob) onConfirm(blob)
        },
        'image/jpeg',
        0.92
      )
    } catch (err) {
      console.error('Failed to crop image:', err)
      setBaking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl space-y-4 rounded-2xl border border-white/10 bg-[#0a0f18] p-5 text-white shadow-[0_0_60px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
            <Move className="h-4 w-4 text-[#4ea1ff]" />
            Ajusta la imagen
          </h3>
          <button onClick={onCancel} className="rounded-md p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[11px] text-slate-400">Arrastra la imagen para elegir qué parte se ve.</p>

        <div
          className="hud-corners relative mx-auto touch-none select-none overflow-hidden border-2 border-[#4ea1ff] bg-black/60"
          style={{ width: '100%', aspectRatio: `${FRAME_W} / ${FRAME_H}`, cursor: ready ? 'grab' : 'default' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Ajustar imagen"
            onLoad={handleImgLoad}
            draggable={false}
            style={
              ready
                ? {
                    position: 'absolute',
                    left: `${(offset.x / FRAME_W) * 100}%`,
                    top: `${(offset.y / FRAME_H) * 100}%`,
                    width: `${((natural.w * coverScale) / FRAME_W) * 100}%`,
                    height: `${((natural.h * coverScale) / FRAME_H) * 100}%`,
                    maxWidth: 'none',
                  }
                : { opacity: 0, position: 'absolute' }
            }
          />
          {ready && (
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="border border-white/15" />
              ))}
            </div>
          )}
          {!ready && (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/10 bg-transparent px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-white/5 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!ready || baking}
            className="rounded-lg bg-[#1274de] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#1f82ee] disabled:opacity-50 cursor-pointer"
          >
            {baking ? 'Aplicando...' : 'Usar esta posición'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ImagePicker({ name, defaultValue = '', label = 'League Banner Image', hideGallery = false, onChange, entityName }: ImagePickerProps) {
  const [images, setImages] = useState<string[]>([])
  const [selected, setSelected] = useState<string>(defaultValue)
  const [loadingList, setLoadingList] = useState(true)
  const [galleryRestricted, setGalleryRestricted] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [repositionSrc, setRepositionSrc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSelected(defaultValue)
  }, [defaultValue])

  const handleSelect = (url: string) => {
    setSelected(url)
    onChange?.(url)
  }

  // Fetch all images from API — the gallery list itself is admin-only; the API
  // signals that with `restricted: true` and an empty list for other users.
  const fetchImages = async () => {
    try {
      const res = await fetch('/api/uploads')
      if (res.ok) {
        const data = await res.json()
        setImages(data.images || [])
        setGalleryRestricted(Boolean(data.restricted))
      }
    } catch (err) {
      console.error('Failed to load uploads gallery:', err)
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    fetchImages()
  }, [])

  const uploadBlob = async (blob: Blob) => {
    setUploading(true)
    const formData = new FormData()
    formData.append('file', blob, 'image.jpg')
    if (name.toLowerCase().includes('logo')) {
      formData.append('type', 'logo')
    } else {
      formData.append('type', 'banner')
    }
    if (entityName && entityName.trim()) {
      formData.append('entityName', entityName.trim())
    }

    try {
      const res = await fetch('/api/uploads', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          setImages((prev) => (prev.includes(data.url) ? prev : [data.url, ...prev]))
          handleSelect(data.url)
        }
      } else {
        const errData = await res.json()
        alert(errData.error || 'Failed to upload image')
      }
    } catch (err) {
      console.error('Upload error:', err)
      alert('An error occurred while uploading the image')
    } finally {
      setUploading(false)
    }
  }

  // File picked from disk: open the reposition step instead of uploading immediately
  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRepositionSrc(URL.createObjectURL(file))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Reposition an image that's already selected
  const handleRepositionExisting = async () => {
    if (!selected) return
    try {
      const res = await fetch(selected)
      const blob = await res.blob()
      setRepositionSrc(URL.createObjectURL(blob))
    } catch (err) {
      console.error('Failed to load image for repositioning:', err)
      alert('No se pudo cargar la imagen para ajustarla.')
    }
  }

  const handleRepositionConfirm = (blob: Blob) => {
    setRepositionSrc(null)
    uploadBlob(blob)
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!confirm('¿Eliminar esta imagen?')) return
    setDeleting(true)
    try {
      const res = await fetch('/api/uploads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: selected }),
      })
      if (res.ok) {
        setImages((prev) => prev.filter((url) => url !== selected))
        handleSelect('')
      } else {
        const errData = await res.json()
        alert(errData.error || 'No se pudo eliminar la imagen.')
      }
    } catch (err) {
      console.error('Delete error:', err)
      alert('No se pudo eliminar la imagen.')
    } finally {
      setDeleting(false)
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-3">
      {/* Hidden input field for the form */}
      <input type="hidden" name={name} value={selected} />

      {/* Header with Upload Trigger */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-350 font-semibold uppercase tracking-wider">
          {label}</span>
        <button
          type="button"
          onClick={triggerFileInput}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 border border-shell-line bg-white/5 hover:bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white transition-colors cursor-pointer disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="h-3 w-3 text-cyan-400" />
              <span>Upload image</span>
            </>
          )}
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFilePicked}
          accept="image/*"
          className="hidden"
        />
      </div>

      {/* Selected Preview Box */}
      {selected ? (
        <div className="hud-corners relative aspect-[3/1] w-full border border-shell-line bg-black/40 overflow-hidden group">
          <Image
            src={selected}
            alt="Selected Banner Preview"
            fill
            sizes="(max-width: 768px) 100vw, 500px"
            quality={90}
            className="object-cover object-center"
          />
          <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={handleRepositionExisting}
              title="Ajustar posición"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/70 text-white transition-colors hover:border-[#4ea1ff] hover:text-[#4ea1ff] cursor-pointer"
            >
              <Move className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              title="Eliminar imagen"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/70 text-white transition-colors hover:border-rose-500 hover:text-rose-500 disabled:opacity-50 cursor-pointer"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center aspect-[3/1] w-full border border-dashed border-white/10 bg-black/20 text-center p-4">
          <span className="text-xs text-slate-400">{hideGallery ? 'No logo selected.' : 'No banner selected.'}</span>
          <span className="text-[10px] text-slate-500 mt-1">{hideGallery ? 'Upload a team logo image to get started.' : 'Select an image below or upload a new one.'}</span>
        </div>
      )}

      {/* Thumbnail Selection Gallery */}
      {!hideGallery && !galleryRestricted && (
        <div className="border border-shell-line bg-black/40 p-3">
          <label className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">
            Select from Gallery ({images.length} available)
          </label>

          {loadingList ? (
            <div className="flex items-center justify-center py-6 gap-2 text-slate-400 text-xs">
              <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
              <span>Loading gallery...</span>
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              No images uploaded yet. Upload one to get started!
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 max-h-[140px] overflow-y-auto pr-1 select-none">
              {images.map((url) => {
                const isSelected = selected === url
                return (
                  <div
                    key={url}
                    onClick={() => handleSelect(url)}
                    className={`relative aspect-[3/2] cursor-pointer border transition-all group overflow-hidden ${
                      isSelected
                        ? 'border-[#1274de] ring-1 ring-[#1274de]'
                        : 'border-white/10 hover:border-slate-400'
                    }`}
                  >
                    <Image
                      src={url}
                      alt="Gallery item"
                      fill
                      sizes="120px"
                      className="object-cover object-center group-hover:scale-105 transition-transform"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-[#1274de]/25 flex items-center justify-center">
                        <div className="bg-[#1274de] p-0.5 rounded-full text-white shadow-lg">
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {repositionSrc && (
        <RepositionModal
          imageSrc={repositionSrc}
          onCancel={() => setRepositionSrc(null)}
          onConfirm={handleRepositionConfirm}
        />
      )}
    </div>
  )
}
