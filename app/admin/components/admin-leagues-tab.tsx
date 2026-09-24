import React from 'react'
import Image from 'next/image'
import { simulatorLabel } from '@/lib/utils'
import { ImagePicker } from '@/components/image-picker'
import { DeleteLeagueButton } from '@/components/delete-league-button'
import {
  quickUpdateLeagueStatusAction,
  quickToggleLeagueFeaturedAction,
  deleteLeagueAction,
  createSimulatorAction,
  updateSimulatorAction,
  deleteSimulatorAction,
} from '../actions'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

type AdminLeaguesTabProps = {
  simulators: Array<{ key: string; name: string; logoUrl: string | null }>
  visibleLeagues: any[]
  visibleRegistrations: any[]
  visibleEvents: any[]
}

export async function AdminLeaguesTab({ simulators, visibleLeagues, visibleRegistrations, visibleEvents }: AdminLeaguesTabProps) {
  const t = getDictionary(await getLocale()).admin.leaguesTab
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-shell-line pb-3">
          <div>
            <h2 className="font-display-condensed text-sm font-bold uppercase tracking-wide text-white">{t.title}</h2>
            <p className="text-xs text-slate-400">{t.subtitle}</p>
          </div>
        </div>

        <div className="overflow-x-auto border border-shell-line bg-black/10">
          <table className="w-full min-w-[640px] text-left border-collapse">
            <thead>
              <tr className="border-b border-shell-line bg-black/40 text-xxs font-black uppercase tracking-wider text-slate-400">
                <th className="p-3">{t.colLeague}</th>
                <th className="p-3">{t.colSimulator}</th>
                <th className="p-3">{t.colStatus}</th>
                <th className="p-3">{t.colFeatured}</th>
                <th className="p-3 text-center">{t.colRounds}</th>
                <th className="p-3 text-center">{t.colRegistered}</th>
                <th className="p-3 text-right">{t.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-slate-300">
              {visibleLeagues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 italic">{t.noLeagues}</td>
                </tr>
              ) : (
                visibleLeagues.map((league) => {
                  const leagueRegistrations = Array.from(
                    new Set(
                      visibleRegistrations
                        .filter((item) => item.leagueId === league.id && item.status !== 'rejected')
                        .map((item) => `${item.teamId || item.userId}_${item.classTag || 'default'}`)
                    )
                  ).length
                  const leagueEvents = visibleEvents.filter((event) => event.leagueId === league.id).length
                  return (
                    <tr key={league.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3 font-bold text-white flex items-center gap-3">
                        <div className="w-12 h-7 bg-zinc-950 overflow-hidden border border-white/10 shrink-0 flex items-center justify-center">
                          {league.bannerUrl ? (
                            <Image src={league.bannerUrl} alt="" width={48} height={28} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-slate-600 font-extrabold uppercase">L</span>
                          )}
                        </div>
                        <span className="truncate max-w-[180px]" title={league.title}>{league.title}</span>
                      </td>
                      <td className="p-3 text-slate-400 font-semibold">{simulatorLabel(league.simulator, simulators)}</td>
                      <td className="p-3">
                        <form action={quickUpdateLeagueStatusAction} className="flex items-center gap-1.5">
                          <input type="hidden" name="leagueId" value={league.id} />
                          <select
                            name="status"
                            defaultValue={league.status}
                            className="rounded-lg border border-shell-line bg-black/45 px-2 py-1 text-xxs font-bold text-slate-200 outline-none cursor-pointer focus:border-white/30 uppercase tracking-wider"
                          >
                            <option value="draft">{t.statusDraft}</option>
                            <option value="open">{t.statusOpen}</option>
                            <option value="ongoing">{t.statusOngoing}</option>
                            <option value="closed">{t.statusClosed}</option>
                            <option value="finished">{t.statusFinished}</option>
                          </select>
                          <button type="submit" className="border border-white/20 bg-white/5 hover:bg-[#1274de] hover:border-[#1274de] px-2 py-1 text-[9px] uppercase font-black text-white transition-colors cursor-pointer">
                            {t.save}
                          </button>
                        </form>
                      </td>
                      <td className="p-3">
                        <form action={quickToggleLeagueFeaturedAction}>
                          <input type="hidden" name="leagueId" value={league.id} />
                          <button type="submit" className={`px-2 py-1 text-[9px] font-black uppercase border rounded-lg cursor-pointer transition-colors ${
                            league.featured 
                              ? 'border-amber-500/35 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20' 
                              : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                          }`}>
                            {league.featured ? t.featured : t.standard}
                          </button>
                        </form>
                      </td>
                      <td className="p-3 text-center font-bold text-slate-200">{leagueEvents}</td>
                      <td className="p-3 text-center font-bold text-slate-200">{leagueRegistrations}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <DeleteLeagueButton
                            leagueId={league.id}
                            leagueTitle={league.title}
                            deleteAction={deleteLeagueAction}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5 space-y-4">
        <div className="border-b border-shell-line pb-3">
          <h2 className="font-display-condensed text-sm font-bold uppercase tracking-wide text-white">Simuladores</h2>
          <p className="text-xs text-slate-400">
            Los simuladores disponibles al crear un campeonato. El logo de cada uno aparece arriba a la derecha dentro del campeonato y en el calendario.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {simulators.map((sim) => (
            <div key={sim.key} className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
              <form action={updateSimulatorAction} className="space-y-2">
                <input type="hidden" name="key" value={sim.key} />
                <input
                  name="name"
                  defaultValue={sim.name}
                  className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-sm font-bold text-white outline-none"
                />
                <ImagePicker name="logoUrl" defaultValue={sim.logoUrl || ''} label="Logo del juego" entityName={sim.name} square hideGallery />
                <button type="submit" className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white transition-colors hover:bg-[#1274de] cursor-pointer">
                  {t.save}
                </button>
              </form>
              <form action={deleteSimulatorAction}>
                <input type="hidden" name="key" value={sim.key} />
                <button type="submit" className="text-[10px] font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300 cursor-pointer">
                  Eliminar (solo si ningún campeonato lo usa)
                </button>
              </form>
            </div>
          ))}

          <form action={createSimulatorAction} className="space-y-2 rounded-xl border border-dashed border-[#4ea1ff]/40 bg-[#4ea1ff]/5 p-3">
            <p className="text-xs font-black uppercase tracking-wider text-[#4ea1ff]">Añadir simulador</p>
            <input
              name="name"
              required
              placeholder="Ej: rFactor 2, Gran Turismo 7…"
              className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
            />
            <ImagePicker name="logoUrl" label="Logo del juego" entityName="simulador" square hideGallery />
            <button type="submit" className="rounded-lg border border-[#4ea1ff] bg-[#1274de] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white transition-colors hover:bg-[#1f82ee] cursor-pointer">
              Añadir
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
