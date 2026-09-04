import React from 'react'
import Image from 'next/image'
import { ShieldCheck, User } from 'lucide-react'
import { SubmitButton } from '@/components/submit-button'
import { ConfirmForm } from '@/components/confirm-form'
import { grantAdminAction, revokeAdminAction } from '../actions'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

type AdminGrant = {
  steamId: string
  grantedByName: string
  createdAt: string
  displayName: string | null
  avatarUrl: string | null
}

type AdminAdminsTabProps = {
  grants: AdminGrant[]
  fixedAdminSteamIds: string[]
  currentUserSteamId: string
}

export async function AdminAdminsTab({ grants, fixedAdminSteamIds, currentUserSteamId }: AdminAdminsTabProps) {
  const t = getDictionary(await getLocale()).admin.adminsTab

  return (
    <div className="space-y-6">
      {/* Grant form */}
      <section className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5 space-y-4">
        <div className="border-b border-shell-line pb-3">
          <h2 className="font-display-condensed text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent" />
            {t.grantTitle}
          </h2>
          <p className="text-xs text-slate-400 mt-1">{t.subtitle}</p>
        </div>

        <form action={grantAdminAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">{t.steamIdLabel}</label>
            <input
              type="text"
              name="steamId"
              required
              pattern="\d{10,20}"
              placeholder={t.steamIdPlaceholder}
              className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2.5 text-xs font-mono text-white outline-none focus:border-accent transition-colors"
            />
            <p className="mt-1.5 text-[10px] text-slate-500">{t.steamIdHint}</p>
          </div>
          <SubmitButton
            label={t.grantButton}
            pendingLabel={t.grantButton}
            className="shrink-0 rounded-lg bg-[#1274de] hover:bg-[#1f82ee] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors cursor-pointer"
          />
        </form>
      </section>

      {/* Current granted admins */}
      <section className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5 space-y-4">
        <div className="border-b border-shell-line pb-3">
          <h2 className="font-display-condensed text-sm font-bold uppercase tracking-wide text-white">{t.currentAdminsTitle}</h2>
          <p className="text-xs text-slate-400 mt-1">{t.currentAdminsSubtitle}</p>
        </div>

        <div className="overflow-x-auto border border-shell-line bg-black/10 rounded-lg">
          <table className="w-full min-w-[480px] text-left border-collapse">
            <thead>
              <tr className="border-b border-shell-line bg-black/40 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="p-3">{t.colName}</th>
                <th className="p-3">{t.colSteamId}</th>
                <th className="p-3">{t.colGrantedBy}</th>
                <th className="p-3">{t.colDate}</th>
                <th className="p-3 text-right">{t.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-slate-300">
              {grants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 italic">{t.noGrants}</td>
                </tr>
              ) : (
                grants.map((grant) => (
                  <tr key={grant.steamId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 font-bold text-white">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-shell-line bg-black/40">
                          {grant.avatarUrl ? (
                            <Image src={grant.avatarUrl} alt={grant.displayName || grant.steamId} width={32} height={32} className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-4 w-4 text-slate-500" />
                          )}
                        </div>
                        <span>
                          {grant.displayName || <span className="italic text-slate-500 font-normal">{t.pendingLogin}</span>}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-slate-300">{grant.steamId}</td>
                    <td className="p-3 text-slate-300">{grant.grantedByName}</td>
                    <td className="p-3 text-slate-400 font-mono text-[11px]">
                      {(() => {
                        try {
                          const d = new Date(grant.createdAt)
                          return isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
                        } catch {
                          return '—'
                        }
                      })()}
                    </td>
                    <td className="p-3 text-right">
                      {grant.steamId === currentUserSteamId ? (
                        <span className="text-[10px] text-slate-500 italic">—</span>
                      ) : (
                        <ConfirmForm action={revokeAdminAction} confirmMessage={t.revokeConfirm}>
                          <input type="hidden" name="steamId" value={grant.steamId} />
                          <button
                            type="submit"
                            className="rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-700 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-200 hover:text-white transition-colors cursor-pointer"
                          >
                            {t.revoke}
                          </button>
                        </ConfirmForm>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Fixed / env-configured admins */}
      <section className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5 space-y-4">
        <div className="border-b border-shell-line pb-3">
          <h2 className="font-display-condensed text-sm font-bold uppercase tracking-wide text-white">{t.fixedAdminsTitle}</h2>
          <p className="text-xs text-slate-400 mt-1">{t.fixedAdminsSubtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {fixedAdminSteamIds.map((steamId) => (
            <span key={steamId} className="rounded-lg border border-shell-line bg-black/30 px-3 py-1.5 font-mono text-xs text-slate-300">
              {steamId}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
