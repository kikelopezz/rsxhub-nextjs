'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

function format(ms: number) {
  const totalMinutes = Math.floor(ms / 60_000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/**
 * Live "time left" chip for a round deadline (skin delivery, car registration…).
 * Turns amber under 3 days, red under 24 h and shows "closed" once it has passed.
 */
export function DeadlineCountdown({
  label,
  deadline,
  closedLabel,
  className = '',
}: {
  label: string
  deadline: string | null | undefined
  closedLabel: string
  className?: string
}) {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!deadline) return null
  const target = new Date(deadline).getTime()
  if (Number.isNaN(target)) return null

  const left = now === null ? null : target - now
  const closed = left !== null && left <= 0
  const tone = closed
    ? 'border-slate-600/50 bg-slate-900/60 text-slate-400'
    : left !== null && left < 86_400_000
      ? 'border-rose-500/50 bg-rose-950/40 text-rose-300'
      : left !== null && left < 3 * 86_400_000
        ? 'border-amber-500/50 bg-amber-950/40 text-amber-300'
        : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'

  return (
    <span
      title={new Date(deadline).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}
      className={`font-mono-data inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${tone} ${className}`}
    >
      <Clock className="h-3 w-3" />
      <span>{label}</span>
      <span className="text-white/90">{left === null ? '…' : closed ? closedLabel : format(left)}</span>
    </span>
  )
}
