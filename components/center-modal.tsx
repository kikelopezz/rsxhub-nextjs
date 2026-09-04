'use client'

import { ReactNode, CSSProperties, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type CenterModalProps = {
  title: string
  triggerLabel: string
  triggerClassName?: string
  triggerStyle?: CSSProperties
  widthClassName?: string
  children: ReactNode | ((close: () => void) => ReactNode)
}

export function CenterModal({ title, triggerLabel, triggerClassName, triggerStyle, widthClassName, children }: CenterModalProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [rendered, setRendered] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openModal = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setRendered(true)
    requestAnimationFrame(() => setOpen(true))
  }

  const closeModal = () => {
    setOpen(false)
    closeTimerRef.current = setTimeout(() => {
      setRendered(false)
      closeTimerRef.current = null
    }, 220)
  }

  useEffect(() => {
    setMounted(true)
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  useEffect(() => {
    if (!rendered) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [rendered])

  return (
    <>
      <button type="button" onClick={openModal} className={triggerClassName} style={triggerStyle}>
        {triggerLabel}
      </button>
      {rendered && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/70 backdrop-blur-[1px] p-4 flex justify-center items-start md:items-center">
              <button
                type="button"
                aria-label="Close"
                className="fixed inset-0 cursor-default bg-transparent w-full h-full"
                onClick={closeModal}
              />
              <div
                className={`relative my-auto bg-[#070f1b] p-4 rounded-lg border border-shell-line shadow-2xl transition-all duration-200 md:p-5 ${
                  open ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                } ${widthClassName || 'w-[min(1100px,94vw)]'}`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-xl font-black uppercase italic text-white">{title}</h3>
                  <button type="button" onClick={closeModal} className="rounded-lg border border-shell-line bg-white/10 px-3 py-1 text-xs font-bold uppercase text-white transition-colors hover:bg-white/20 cursor-pointer">
                    Close
                  </button>
                </div>
                {typeof children === 'function' ? children(closeModal) : children}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
