'use client'

import { useState } from 'react'
import { CONNECTION_PLATFORMS, connectionDisplay, parseConnections, type ConnectionKey } from '@/lib/connections'
import { useDictionary } from '@/lib/i18n/locale-provider'

/** Chips con las redes del piloto. Los enlaces se validan otra vez aquí: solo se pintan URLs https de la plataforma. */
export function ConnectionChips({ connections, className = '' }: { connections: unknown; className?: string }) {
  const t = useDictionary().perfil.content
  const [copied, setCopied] = useState<ConnectionKey | null>(null)
  const clean = parseConnections(connections)
  const entries = CONNECTION_PLATFORMS.filter((p) => clean[p.key])

  if (entries.length === 0) return null

  const chip =
    'group inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-white/30 hover:bg-white/10'

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {entries.map((p) => {
        const value = clean[p.key]!
        const dot = <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color, boxShadow: `0 0 8px ${p.color}` }} />
        const label = (
          <>
            {dot}
            <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 group-hover:text-slate-300">{p.label}</span>
            <span className="max-w-[180px] truncate">{connectionDisplay(p.key, value)}</span>
          </>
        )

        if (p.key === 'discord') {
          return (
            <button
              key={p.key}
              type="button"
              title={t.connectionsCopyUser}
              onClick={() => {
                navigator.clipboard?.writeText(value).catch(() => {})
                setCopied(p.key)
                setTimeout(() => setCopied(null), 1800)
              }}
              className={`${chip} cursor-pointer`}
            >
              {label}
              {copied === p.key && <span className="text-[10px] font-bold text-emerald-400">{t.connectionsCopied}</span>}
            </button>
          )
        }

        return (
          <a key={p.key} href={value} target="_blank" rel="noopener noreferrer nofollow" className={chip}>
            {label}
          </a>
        )
      })}
    </div>
  )
}
