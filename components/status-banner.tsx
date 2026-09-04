'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react'

export type StatusMessage = { kind: 'ok' | 'warn' | 'error'; text: string } | null

const KIND_STYLES = {
  ok: {
    border: 'border-emerald-400/30',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-100',
    icon: 'text-emerald-400',
    bar: 'bg-emerald-400',
    glow: 'shadow-[0_4px_24px_-4px_rgba(16,185,129,0.35)]',
    Icon: CheckCircle2,
  },
  warn: {
    border: 'border-amber-400/30',
    bg: 'bg-amber-500/10',
    text: 'text-amber-100',
    icon: 'text-amber-400',
    bar: 'bg-amber-400',
    glow: 'shadow-[0_4px_24px_-4px_rgba(245,158,11,0.35)]',
    Icon: AlertTriangle,
  },
  error: {
    border: 'border-red-400/30',
    bg: 'bg-red-500/10',
    text: 'text-red-100',
    icon: 'text-red-400',
    bar: 'bg-red-400',
    glow: 'shadow-[0_4px_24px_-4px_rgba(248,113,113,0.35)]',
    Icon: XCircle,
  },
} as const

/**
 * Renders a save/action confirmation banner. Captures `message` into local state on
 * mount so the banner keeps showing on its own timer even after the page clears the
 * `?updated=1`-style query param that produced it (which happens almost immediately —
 * without this, the banner would flash and vanish before anyone could read it).
 */
export function StatusBanner({ message, durationMs = 5000 }: { message: StatusMessage; durationMs?: number }) {
  const [shown, setShown] = useState<StatusMessage>(null)
  const [visible, setVisible] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // `message` comes from a URL query param that gets stripped moments after mount
  // (see ClearStatusQuery), which re-renders this with `message: null`. That must NOT
  // cancel the countdown already running — only a genuinely new message should reset
  // it — so the timer lives in a ref instead of a dependency-driven effect cleanup.
  useEffect(() => {
    if (!message) return
    setShown(message)
    setVisible(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setVisible(false), durationMs)
  }, [message, durationMs])

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (visible || !shown) return
    const removeTimer = setTimeout(() => setShown(null), 400)
    return () => clearTimeout(removeTimer)
  }, [visible, shown])

  if (!shown) return null

  const style = KIND_STYLES[shown.kind]
  const Icon = style.Icon

  return (
    <div
      role="status"
      className={`relative flex items-start gap-3 overflow-hidden rounded-lg border ${style.border} ${style.bg} ${style.glow} py-3 pl-4 pr-10 text-sm ${style.text} transition-all duration-400 ease-out ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-1.5 opacity-0'
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} />
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.icon}`} />
      <p className="font-medium leading-relaxed">{shown.text}</p>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Cerrar"
        className="absolute right-2.5 top-2.5 rounded-lg p-1 text-current opacity-50 transition-opacity hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
