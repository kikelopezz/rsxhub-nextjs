'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { SendHorizontal } from 'lucide-react'
import { getTicketMessagesAction, sendTicketMessageAction } from './actions'

type ChatMessage = {
  id: string
  authorId: string
  authorTag: string
  authorAvatarUrl: string | null
  isBot: boolean
  content: string
  createdAt: string
}

const POLL_MS = 4000

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

/**
 * Conversación del canal de Discord del ticket, dentro del propio Hub. Se sondea cada pocos
 * segundos (no hay un canal en vivo de verdad entre el bot y el Hub) y solo mientras el <details>
 * que lo envuelve está abierto — si no, no tiene sentido gastar peticiones de fondo.
 */
export function TicketChat({ guildId, ticketId }: { guildId: string; ticketId: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loaded, setLoaded] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const lastIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    const details = rootRef.current?.closest('details')
    if (!details) return
    setOpen(details.open)
    const onToggle = () => setOpen(details.open)
    details.addEventListener('toggle', onToggle)
    return () => details.removeEventListener('toggle', onToggle)
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function poll() {
      const fresh = await getTicketMessagesAction(guildId, ticketId, lastIdRef.current)
      if (cancelled || fresh.length === 0) return
      lastIdRef.current = fresh[fresh.length - 1].id
      setMessages((prev) => [...prev, ...fresh])
      setLoaded(true)
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }))
    }

    poll()
    const id = setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [open, guildId, ticketId])

  const send = () => {
    const content = text.trim()
    if (!content) return
    setText('')
    setError('')
    startTransition(async () => {
      const res = await sendTicketMessageAction(guildId, ticketId, content)
      if (!res.ok) setError(res.message)
    })
  }

  return (
    <div ref={rootRef} className="space-y-2 border-t border-white/10 px-4 py-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Conversación en Discord</p>

      <div ref={listRef} className="max-h-72 space-y-2.5 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3">
        {!loaded && open && <p className="text-xs text-slate-600">Cargando…</p>}
        {loaded && messages.length === 0 && <p className="text-xs text-slate-600">Sin mensajes todavía.</p>}
        {messages.map((m) => (
          <div key={m.id} className="flex items-baseline gap-2 text-xs">
            <span className={`font-bold ${m.isBot ? 'text-[#4ea1ff]' : 'text-white'}`}>{m.authorTag}</span>
            <span className="text-[10px] text-slate-600">{formatTime(m.createdAt)}</span>
            <p className="whitespace-pre-wrap break-words text-slate-300">{m.content}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="Escribe y se manda al canal de Discord…"
          maxLength={1900}
          className="flex-1 rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-[#4ea1ff]"
        />
        <button
          type="button"
          disabled={pending || !text.trim()}
          onClick={send}
          className="flex items-center gap-1.5 rounded-lg bg-[#1274de] px-3 py-2 text-[11px] font-black uppercase text-white hover:bg-[#1f82ee] disabled:opacity-50"
        >
          <SendHorizontal className="h-3.5 w-3.5" />
          Enviar
        </button>
      </div>
      {error && <p className="text-[10px] text-rose-400">{error}</p>}
    </div>
  )
}
