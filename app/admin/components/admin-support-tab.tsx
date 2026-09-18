import Link from 'next/link'
import Image from 'next/image'
import { AlertTriangle, CheckCircle2, KeyRound, User } from 'lucide-react'
import { db } from '@/lib/db'
import { SubmitButton } from '@/components/submit-button'
import { ConfirmForm } from '@/components/confirm-form'
import { grantTicketAccessAction, revokeTicketAccessAction } from '@/app/soporte/actions'

const FEEDBACK: Record<string, { ok: boolean; message: string }> = {
  granted: { ok: true, message: 'Permiso concedido.' },
  revoked: { ok: true, message: 'Permiso revocado.' },
  'invalid-steamid': { ok: false, message: 'El Steam ID no es válido (deben ser 10-20 dígitos).' },
  'grant-failed': { ok: false, message: 'No se pudo conceder el permiso. Inténtalo de nuevo.' },
}

export async function AdminSupportTab({ feedback }: { feedback?: string }) {
  const grants = await db.ticketAccessGrant.findMany({ orderBy: { createdAt: 'desc' } })
  const accounts = grants.length > 0 ? await db.steamAccount.findMany({ where: { steamId: { in: grants.map((g) => g.steamId) } } }) : []
  const profiles = accounts.length > 0 ? await db.profile.findMany({ where: { userId: { in: accounts.map((a) => a.userId) } } }) : []

  const rows = grants.map((g) => {
    const account = accounts.find((a) => a.steamId === g.steamId)
    const profile = account ? profiles.find((p) => p.userId === account.userId) : undefined
    return { ...g, displayName: profile?.displayName || null, avatarUrl: profile?.avatarUrl || null }
  })

  const message = feedback ? FEEDBACK[feedback] : undefined

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
            message.ok ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100' : 'border-rose-400/40 bg-rose-500/10 text-rose-100'
          }`}
        >
          {message.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {message.message}
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5">
        <div className="border-b border-shell-line pb-3">
          <h2 className="flex items-center gap-2 font-display-condensed text-sm font-bold uppercase tracking-wide text-white">
            <KeyRound className="h-4 w-4 text-accent" /> Permiso para la sección Soporte
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            La sección <strong>Soporte</strong> (tickets de Discord) la ven siempre los administradores. Aquí añades a otras personas que no son admins para que también puedan verla y gestionar tickets.
          </p>
          <Link href="/soporte" className="mt-2 inline-block text-[11px] font-bold uppercase tracking-wider text-[#4ea1ff] hover:underline">
            Abrir Soporte →
          </Link>
        </div>
        <form action={grantTicketAccessAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">Steam ID (SteamID64)</label>
            <input
              type="text"
              name="steamId"
              required
              pattern="\d{10,20}"
              placeholder="76561198000000000"
              className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2.5 font-mono text-xs text-white outline-none transition-colors focus:border-accent"
            />
          </div>
          <SubmitButton
            label="Dar permiso"
            pendingLabel="Guardando…"
            className="shrink-0 cursor-pointer rounded-lg bg-[#1274de] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#1f82ee]"
          />
        </form>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5">
        <h2 className="border-b border-shell-line pb-3 font-display-condensed text-sm font-bold uppercase tracking-wide text-white">Personas con permiso (además de los admins)</h2>
        <div className="overflow-x-auto rounded-lg border border-shell-line bg-black/10">
          <table className="w-full min-w-[480px] border-collapse text-left">
            <thead>
              <tr className="border-b border-shell-line bg-black/40 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="p-3">Nombre</th>
                <th className="p-3">Steam ID</th>
                <th className="p-3">Concedido por</th>
                <th className="p-3">Fecha</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-slate-300">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center italic text-slate-500">Nadie más tiene permiso todavía.</td>
                </tr>
              ) : (
                rows.map((g) => (
                  <tr key={g.steamId} className="transition-colors hover:bg-white/[0.02]">
                    <td className="p-3 font-bold text-white">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-shell-line bg-black/40">
                          {g.avatarUrl ? (
                            <Image src={g.avatarUrl} alt={g.displayName || g.steamId} width={32} height={32} className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-4 w-4 text-slate-500" />
                          )}
                        </div>
                        {g.displayName || <span className="font-normal italic text-slate-500">Aún no ha iniciado sesión</span>}
                      </div>
                    </td>
                    <td className="p-3 font-mono">{g.steamId}</td>
                    <td className="p-3">{g.grantedByName}</td>
                    <td className="p-3 font-mono text-[11px] text-slate-400">{g.createdAt.toLocaleDateString('es-ES')}</td>
                    <td className="p-3 text-right">
                      <ConfirmForm action={revokeTicketAccessAction} confirmMessage="¿Quitar el permiso de Soporte a esta persona?">
                        <input type="hidden" name="steamId" value={g.steamId} />
                        <button type="submit" className="cursor-pointer rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-200 transition-colors hover:bg-rose-700 hover:text-white">
                          Revocar
                        </button>
                      </ConfirmForm>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
