'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import type { CreatedChannel } from '@/lib/tickets-api'
import { createDiscordChannelAction } from '../actions'

type Props = {
  guildId: string
  kind: 'text' | 'category'
  staffOnly?: boolean
  defaultName: string
  label: string
  onCreated: (channel: CreatedChannel) => void
}

/** "＋ Crear nuevo": crea el canal o la categoría directamente en Discord y lo deja seleccionado. */
export function CreateChannelInline({ guildId, kind, staffOnly = false, defaultName, label, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(defaultName)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const create = () =>
    startTransition(async () => {
      setError(null)
      const result = await createDiscordChannelAction(guildId, { name, kind, staffOnly })
      if (!result.ok || !result.channel) return setError(result.message)
      onCreated(result.channel)
      setOpen(false)
    })

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#4ea1ff] hover:underline"
      >
        <Plus className="h-3 w-3" /> {label}
      </button>
    )
  }

  return (
    <div className="mt-2 space-y-1.5 rounded-lg border border-[#4ea1ff]/30 bg-[rgba(78,161,255,.06)] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (!pending) create()
            }
          }}
          className="min-w-[10rem] flex-1 rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-[#4ea1ff]"
        />
        <button
          type="button"
          disabled={pending}
          onClick={create}
          className="rounded-lg bg-[#1274de] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-[#1f82ee] disabled:opacity-60"
        >
          {pending ? 'Creando…' : 'Crear en Discord'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setOpen(false)}
          className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold uppercase text-slate-400 hover:bg-white/5"
        >
          Cancelar
        </button>
      </div>
      {staffOnly && <p className="text-[10px] text-slate-400">Se crea oculto: solo lo ven el bot y los roles de staff.</p>}
      {error && <p className="text-[11px] font-semibold text-rose-300">{error}</p>}
    </div>
  )
}
