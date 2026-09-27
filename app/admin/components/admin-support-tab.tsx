import Link from 'next/link'
import { AlertTriangle, KeyRound, User } from 'lucide-react'
import { db } from '@/lib/db'
import { SubmitButton } from '@/components/submit-button'
import { ConfirmForm } from '@/components/confirm-form'
import { grantTicketAccessAction, revokeTicketAccessAction } from '@/app/soporte/actions'

export async function AdminSupportTab({ feedback }: { feedback?: string }) {
  const grants = await db.ticketAccessGrant.findMany({ orderBy: { createdAt: 'desc' } })
  const steamAccounts = grants.length > 0 ? await db.steamAccount.findMany({ where: { steamId: { in: grants.map((g) => g.steamId) } } }) : []
  const nameBySteamId = new Map(steamAccounts.map((s) => [s.steamId, s.steamDisplayName]))

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-5">
        <h2 className="font-display-condensed mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white">
          <KeyRound className="h-4 w-4 text-cyan-400" />
          Acceso a Soporte
        </h2>
        <p className="mb-4 text-xs text-slate-400">
          Da acceso a <Link href="/soporte" className="text-cyan-400 hover:underline">/soporte</Link> a un SteamID concreto sin necesidad de que sea admin de la plataforma.
        </p>

        {feedback === 'invalid-steamid' && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            <AlertTriangle className="h-3.5 w-3.5" />
            SteamID no válido.
          </div>
        )}

        <form action={grantTicketAccessAction} className="flex items-center gap-2">
          <input
            name="steamId"
            placeholder="SteamID64 (p. ej. 76561198000000000)"
            required
            className="w-72 rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
          />
          <SubmitButton className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-black uppercase text-white hover:bg-cyan-500" label="Dar acceso" pendingLabel="…" />
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0c]">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] uppercase tracking-wider text-slate-500">
              <th className="p-3">Persona</th>
              <th className="p-3">Concedido por</th>
              <th className="p-3 text-right">Fecha</th>
              <th className="p-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {grants.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">
                  Nadie tiene acceso extra a Soporte todavía.
                </td>
              </tr>
            ) : (
              grants.map((g) => (
                <tr key={g.steamId} className="hover:bg-white/[0.02]">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-slate-500" />
                      <div>
                        <p className="font-bold text-white">{nameBySteamId.get(g.steamId) || 'Sin cuenta de Steam vinculada'}</p>
                        <p className="font-mono-data text-[10px] text-slate-500">{g.steamId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-slate-400">{g.grantedByName}</td>
                  <td className="p-3 text-right text-slate-500">{new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(g.createdAt)}</td>
                  <td className="p-3 text-right">
                    <ConfirmForm action={revokeTicketAccessAction} confirmMessage="¿Quitar el acceso a Soporte de esta persona?">
                      <input type="hidden" name="steamId" value={g.steamId} />
                      <SubmitButton className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase text-slate-400 hover:border-rose-400/40 hover:text-rose-300" label="Quitar" pendingLabel="…" />
                    </ConfirmForm>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
