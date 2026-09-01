'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function CopyVehicleDriverIdsButton({
  driverSteamIds,
  className = '',
}: {
  driverSteamIds: string[]
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const validIds = driverSteamIds.filter(Boolean)
  const hasDrivers = validIds.length > 0

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!hasDrivers) return

    const joined = validIds.join(';')
    navigator.clipboard.writeText(joined)

    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!hasDrivers}
      title={hasDrivers ? `Copy IDs: ${validIds.join(';')}` : 'No drivers assigned'}
      className={`flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
        !hasDrivers
          ? 'border-slate-800/80 bg-slate-900/40 text-slate-600 cursor-not-allowed opacity-60'
          : copied
          ? 'border-emerald-500 bg-emerald-950/60 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
          : className || 'border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-500/20 text-cyan-300 cursor-pointer'
      }`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-400" />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          <span>Copy IDs</span>
        </>
      )}
    </button>
  )
}
