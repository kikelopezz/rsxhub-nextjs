'use client'

import { useState, useTransition } from 'react'
import { Bot, CheckCircle2, ExternalLink, XCircle } from 'lucide-react'
import { saveDiscordBotTokenAction, disconnectDiscordBotAction } from '../actions'
import type { BotStatus } from '@/lib/discord-bot/status'

// Permisos que necesita en el servidor: ver canales, enviar mensajes, adjuntar archivos, gestionar
// mensajes e historial, y crear/gestionar los canales de cada ticket.
const INVITE_PERMISSIONS = '268553232'

export function BotConnectionCard({ initialStatus }: { initialStatus: BotStatus }) {
  const [status, setStatus] = useState(initialStatus)
  const [token, setToken] = useState('')
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [pending, startTransition] = useTransition()
  // Con el bot ya conectado no hace falta el formulario a la vista; queda un enlace discreto
  // para cambiarlo si algún día hiciera falta (token filtrado, rotarlo, etc.).
  const [showForm, setShowForm] = useState(!initialStatus.ready)

  const managedByEnv = status.source === 'env'

  const save = () =>
    startTransition(async () => {
      setResult(null)
      const formData = new FormData()
      formData.set('token', token)
      const res = await saveDiscordBotTokenAction(formData)
      setResult(res)
      if (res.ok) {
        setToken('')
        setStatus((s) => ({ ...s, configured: true }))
        // El estado real (conectado, tag, servidores) se refresca solo al recargar; con esto basta
        // para no dejar el formulario pidiendo un token que ya se guardó.
        window.location.reload()
      }
    })

  const disconnect = () =>
    startTransition(async () => {
      setResult(null)
      const res = await disconnectDiscordBotAction()
      setResult(res)
      if (res.ok) window.location.reload()
    })

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5">
      <h2 className="flex items-center gap-2 border-b border-shell-line pb-3 font-display-condensed text-sm font-bold uppercase tracking-wide text-white">
        <Bot className="h-4 w-4 text-[#4ea1ff]" />
        Bot de Discord
      </h2>

      <div className="flex flex-wrap items-center gap-3">
        {status.ready ? (
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Conectado como {status.tag}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-300">
            <XCircle className="h-3.5 w-3.5" />
            {status.configured ? 'Desconectado' : 'Sin token configurado'}
          </span>
        )}
        {status.ready && (
          <span className="text-xs text-slate-400">
            En {status.guildCount} servidor{status.guildCount === 1 ? '' : 'es'}
          </span>
        )}
        {status.configured && (
          <span className="text-[10px] text-slate-500">
            Token {managedByEnv ? 'fijado por el servidor' : `guardado, acabado en ${status.tokenHint}`}
          </span>
        )}
      </div>

      {status.applicationId && (
        <a
          href={`https://discord.com/oauth2/authorize?client_id=${status.applicationId}&permissions=${INVITE_PERMISSIONS}&scope=bot`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-1.5 text-xs font-bold text-[#4ea1ff] hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Enlace para invitarlo a un servidor
        </a>
      )}

      {managedByEnv ? (
        <p className="text-xs text-slate-500">
          El token viene de <code className="text-slate-300">DISCORD_BOT_TOKEN</code> en el servidor; para cambiarlo, cambia esa variable ahí.
        </p>
      ) : !showForm ? (
        <button type="button" onClick={() => setShowForm(true)} className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-white">
          Cambiar el token
        </button>
      ) : (
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
            {status.configured ? 'Reemplazar el token' : 'Token del bot'}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Pégalo desde Discord Developer Portal → Bot → Reset Token"
              className="w-full max-w-md rounded-lg border border-shell-line bg-black/40 px-3 py-2.5 text-xs text-white outline-none focus:border-[#4ea1ff]"
            />
            <button
              type="button"
              disabled={pending || !token.trim()}
              onClick={save}
              className="rounded-lg bg-[#1274de] px-4 py-2.5 text-xs font-black uppercase text-white hover:bg-[#1f82ee] disabled:opacity-50"
            >
              {pending ? 'Conectando…' : 'Guardar y conectar'}
            </button>
            {status.configured && (
              <button
                type="button"
                disabled={pending}
                onClick={disconnect}
                className="rounded-lg border border-white/10 px-4 py-2.5 text-xs font-bold uppercase text-slate-400 hover:border-rose-400/40 hover:text-rose-300 disabled:opacity-50"
              >
                Quitar
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-500">
            Se guarda cifrado en la base de datos. Nunca vuelve a mostrarse entero, solo sus últimos 4 caracteres.
          </p>
        </div>
      )}

      {result && (
        <div className={`rounded-lg border px-4 py-2.5 text-xs font-bold ${result.ok ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-400/30 bg-rose-500/10 text-rose-200'}`}>
          {result.message}
        </div>
      )}
    </section>
  )
}
