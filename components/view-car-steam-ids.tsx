'use client'

import { useState, type ReactNode } from 'react'
import { Eye, EyeOff, Copy, Check } from 'lucide-react'
import { CopyVehicleDriverIdsButton } from '@/components/copy-vehicle-driver-ids-button'

export type CarSteamIdEntry = {
  name: string
  steamId: string
  reserve?: boolean
}

/**
 * Action buttons for one car card: [Ver Steam IDs] [Copy IDs] + any extra buttons (children).
 * Renders as a fragment so the expandable list can take its own full-width row inside the
 * parent's flex-wrap header. Admin-only buttons: entries are empty for everyone else, so
 * no Steam ID ever reaches a non-admin's browser.
 */
export function CarSteamIdControls({
  entries,
  driverSteamIds,
  labels,
  className = '',
  children,
}: {
  entries: CarSteamIdEntry[]
  driverSteamIds: string[]
  labels: { show: string; hide: string; reserve: string; copied: string }
  className?: string
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copy = (steamId: string) => {
    navigator.clipboard.writeText(steamId)
    setCopiedId(steamId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const showAdminButtons = entries.length > 0

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {showAdminButtons && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={`flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              className || 'border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-500/20 text-cyan-300'
            }`}
          >
            {open ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span>{open ? labels.hide : labels.show}</span>
          </button>
        )}
        {showAdminButtons && <CopyVehicleDriverIdsButton driverSteamIds={driverSteamIds} className={className} />}
        {children}
      </div>

      {showAdminButtons && open && (
        <ul className="w-full space-y-1">
          {entries.map((e) => (
            <li
              key={`${e.steamId}-${e.reserve ? 'r' : 'd'}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-[10px]"
            >
              <span className="truncate font-semibold text-slate-200">
                {e.name}
                {e.reserve && (
                  <span className="ml-1.5 rounded border border-amber-500/40 bg-amber-950/30 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-300">
                    {labels.reserve}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => copy(e.steamId)}
                title="Copiar Steam ID"
                className="flex shrink-0 items-center gap-1 rounded border border-cyan-500/20 bg-cyan-950/30 px-1.5 py-0.5 font-mono text-cyan-300 hover:text-cyan-100 cursor-pointer"
              >
                {copiedId === e.steamId ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    {labels.copied}
                  </>
                ) : (
                  <>
                    {e.steamId}
                    <Copy className="h-3 w-3" />
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
