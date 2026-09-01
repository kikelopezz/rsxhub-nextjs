'use client'

import { useEffect, useState } from 'react'

export function HudStatusBar() {
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      )
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="hidden md:block border-b border-white/5 text-[10px] font-mono-hud text-slate-400">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-12 py-1">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
            SISTEMA EN LÍNEA
          </span>
          <span className="text-slate-600">|</span>
          <span>RED.SIM.EXPERIENCE // GRID CONTROL</span>
        </div>
        <div className="flex items-center gap-4">
          <span suppressHydrationWarning>{time ?? '--:--:--'}</span>
        </div>
      </div>
    </div>
  )
}
