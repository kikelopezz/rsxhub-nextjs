'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { Upload, Check, Loader2 } from 'lucide-react'

interface ImagePickerProps {
  name: string
  defaultValue?: string
  label?: string
  hideGallery?: boolean
  onChange?: (value: string) => void
}

export function ImagePicker({ name, defaultValue = '', label = 'League Banner Image', hideGallery = false, onChange }: ImagePickerProps) {
  const [images, setImages] = useState<string[]>([])
  const [selected, setSelected] = useState<string>(defaultValue)
  const [loadingList, setLoadingList] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSelected(defaultValue)
  }, [defaultValue])

  const handleSelect = (url: string) => {
    setSelected(url)
    onChange?.(url)
  }

  // Fetch all images from API
  const fetchImages = async () => {
    try {
      const res = await fetch('/api/uploads')
      if (res.ok) {
        const data = await res.json()
        setImages(data.images || [])
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

  // Handle uploading a new file
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    if (name.toLowerCase().includes('logo')) {
      formData.append('type', 'logo')
    } else {
      formData.append('type', 'banner')
    }

    try {
      const res = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          // Add newly uploaded image, select it automatically
          setImages((prev) => {
            if (prev.includes(data.url)) return prev
            return [data.url, ...prev]
          })
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
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
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
          onChange={handleUpload}
          accept="image/*"
          className="hidden"
        />
      </div>

      {/* Selected Preview Box */}
      {selected ? (
        <div className="relative aspect-[3/1] w-full border border-shell-line bg-black/40 overflow-hidden">
          <Image
            src={selected}
            alt="Selected Banner Preview"
            fill
            sizes="(max-width: 768px) 100vw, 500px"
            quality={90}
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
            <span className="text-[10px] text-slate-300 font-mono line-clamp-1 bg-black/60 px-1.5 py-0.5 border border-white/5">
              {selected}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center aspect-[3/1] w-full border border-dashed border-white/10 bg-black/20 text-center p-4">
          <span className="text-xs text-slate-400">{hideGallery ? 'No logo selected.' : 'No banner selected.'}</span>
          <span className="text-[10px] text-slate-500 mt-1">{hideGallery ? 'Upload a team logo image to get started.' : 'Select an image below or upload a new one.'}</span>
        </div>
      )}

      {/* Thumbnail Selection Gallery */}
      {!hideGallery && (
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
    </div>
  )
}
