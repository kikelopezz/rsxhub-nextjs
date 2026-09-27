'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { createDiscordChannelAction } from '../actions'
import type { CreatedChannel } from '@/lib/support-bot-client'

export function CreateChannelInline({
  guildId,
  kind,
  defaultName,
  label,
  staffOnly,
  onCreated,
}: {
  guildId: string
  kind: 'text' | 'category'
  defaultName: string
  label: string
  staffOnly?: boolean
  onCreated: (channel: CreatedChannel) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(defaultName)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#4ea1ff] hover:underline"
      >
        <Plus className="h-3 w-3" />
        {label}
      </button>
    )
  }

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={90}
        className="w-40 rounded-lg border border-shell-line bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#4ea1ff]"
      />
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError('')
            const res = await createDiscordChannelAction(guildId, { name, kind, staffOnly })
            if (res.ok && res.channel) {
              onCreated(res.channel)
              setOpen(false)
            } else {
              setError(res.message)
            }
          })
        }
        className="rounded-lg bg-[#1274de] px-3 py-1.5 text-[10px] font-black uppercase text-white hover:bg-[#1f82ee] disabled:opacity-50"
      >
        {pending ? '…' : 'Crear'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-[10px] font-bold uppercase text-slate-500 hover:text-white">
        Cancelar
      </button>
      {error && <span className="text-[10px] text-rose-400">{error}</span>}
    </div>
  )
}
