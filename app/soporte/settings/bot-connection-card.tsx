import { Bot, CheckCircle2, ExternalLink, XCircle } from 'lucide-react'
import type { BotStatus } from '@/lib/support-bot-client'

// Permisos que necesita en el servidor: ver canales, enviar mensajes, adjuntar archivos, gestionar
// mensajes e historial, y crear/gestionar los canales de cada ticket.
const INVITE_PERMISSIONS = '268553232'

export function BotConnectionCard({ status }: { status: BotStatus }) {
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
            {status.configured ? 'Desconectado' : 'No se pudo contactar con el bot'}
          </span>
        )}
        {status.ready && (
          <span className="text-xs text-slate-400">
            En {status.guildCount} servidor{status.guildCount === 1 ? '' : 'es'}
          </span>
        )}
      </div>

      {!status.ready && status.lastError && (
        <p className="rounded-lg border border-rose-400/20 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-300">{status.lastError}</p>
      )}

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

      <p className="text-xs text-slate-500">
        El bot corre como proceso aparte del Hub (carpeta <code className="text-slate-300">rsx ticket</code>); su token se configura ahí, en su
        propio <code className="text-slate-300">.env</code> del servidor.
      </p>
    </section>
  )
}
