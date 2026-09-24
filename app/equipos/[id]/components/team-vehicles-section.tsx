import { CenterModal } from '@/components/center-modal'
import { CopyVehicleDriverIdsButton } from '@/components/copy-vehicle-driver-ids-button'
import { ViewCarSteamIds, type CarSteamIdEntry } from '@/components/view-car-steam-ids'
import { TeamCarsEditor, SaveTeamCarsButton, CarValidationProvider } from '@/components/team-cars-editor'
import { Download, ShieldAlert } from 'lucide-react'
import { updateTeam } from '@/app/equipos/actions/team-crud'
import type { LeagueOption } from '@/components/team-cars-editor'
import type { TeamMemberOption } from '@/components/team-cars-editor'
import { MAX_DRIVERS_PER_CAR } from '@/components/team-cars-editor/types'
import { MAX_CARS_PER_CATEGORY } from '@/components/team-cars-editor/car-validation'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

type TeamVehiclesSectionProps = {
  team: any
  canManage: boolean
  isAdmin: boolean
  accentHard: string
  takenDorsals: Array<{ teamId: string; teamName: string; category: string; dorsal: string; leagueId?: string | null }>
  leaguesOptions: LeagueOption[]
  teamMembersOptions: TeamMemberOption[]
  leagues: Array<{ id: string; slug: string; title: string }>
}

const CATEGORY_THEMES: Record<string, {
  text: string; border: string; bg: string; badge: string; carBorder: string; carDorsal: string;
  driverActive: string; line: string; skinBtn: string; glow: string
}> = {
  HYPERCAR: {
    text: 'text-rose-400 font-extrabold', border: 'border-rose-500/40', bg: 'bg-rose-950/20',
    badge: 'border-rose-500/40 bg-rose-950/50 text-rose-300',
    carBorder: 'border-rose-500/30 hover:border-rose-400/80 hover:shadow-[0_0_15px_rgba(244,63,94,0.25)]',
    carDorsal: 'text-rose-400 font-black',
    driverActive: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
    line: 'border-rose-500/30',
    skinBtn: 'border-rose-500/40 bg-rose-950/30 hover:bg-rose-500 hover:text-white hover:border-rose-400 text-rose-300',
    glow: 'border-rose-500/30 bg-[#160a0d]/40'
  },
  LMP2: {
    text: 'text-blue-400 font-extrabold', border: 'border-blue-500/40', bg: 'bg-blue-950/20',
    badge: 'border-blue-500/40 bg-blue-950/50 text-blue-300',
    carBorder: 'border-blue-500/30 hover:border-blue-400/80 hover:shadow-[0_0_15px_rgba(59,130,246,0.25)]',
    carDorsal: 'text-blue-400 font-black',
    driverActive: 'border-blue-500/40 bg-blue-500/10 text-blue-100',
    line: 'border-blue-500/30',
    skinBtn: 'border-blue-500/40 bg-blue-950/30 hover:bg-blue-500 hover:text-white hover:border-blue-400 text-blue-300',
    glow: 'border-blue-500/30 bg-[#0a1020]/40'
  },
  GT3: {
    text: 'text-emerald-400 font-extrabold', border: 'border-emerald-500/40', bg: 'bg-emerald-950/20',
    badge: 'border-emerald-500/40 bg-emerald-950/50 text-emerald-300',
    carBorder: 'border-emerald-500/30 hover:border-emerald-400/80 hover:shadow-[0_0_15px_rgba(16,185,129,0.25)]',
    carDorsal: 'text-emerald-400 font-black',
    driverActive: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
    line: 'border-emerald-500/30',
    skinBtn: 'border-emerald-500/40 bg-emerald-950/30 hover:bg-emerald-500 hover:text-white hover:border-emerald-400 text-emerald-300',
    glow: 'border-emerald-500/30 bg-[#08160e]/40'
  },
}

const DEFAULT_THEME = {
  text: 'text-cyan-400', border: 'border-cyan-500/20', bg: 'bg-cyan-950/10',
  badge: 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300',
  carBorder: 'border-cyan-500/20 hover:border-cyan-500/40',
  carDorsal: 'text-cyan-400',
  driverActive: 'border-cyan-500/10 bg-cyan-500/5 text-slate-200',
  line: 'border-[#141f32]/50',
  skinBtn: 'border-cyan-500/20 bg-cyan-950/10 hover:bg-cyan-950/20 text-cyan-300',
  glow: 'border-[#141f32] bg-zinc-950/20'
}

export async function TeamVehiclesSection({
  team,
  canManage,
  isAdmin,
  accentHard,
  takenDorsals,
  leaguesOptions,
  teamMembersOptions,
  leagues,
}: TeamVehiclesSectionProps) {
  const t = getDictionary(await getLocale()).equipos.vehiclesSection
  return (
    <article className="col-span-1 rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:col-span-2 md:p-5">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display-league text-2xl text-white">{t.title}</h2>
          <div className="mt-2 h-1 w-52 rounded-lg" style={{ background: `linear-gradient(90deg, ${accentHard}, transparent)` }} />
        </div>
        {canManage && (
          <CenterModal
            title={t.manageTitle}
            triggerLabel={t.manageVehicles}
            triggerClassName="inline-flex items-center gap-1.5 border bg-black/40 hover:bg-white/5 px-4 py-2.5 text-xs font-bold uppercase italic rounded-lg transition-colors cursor-pointer shrink-0"
            triggerStyle={{ borderColor: accentHard, color: '#fff', boxShadow: `0 0 16px ${accentHard}` }}
            widthClassName="w-[min(1100px,94vw)]"
          >
            <form action={updateTeam} className="space-y-5 p-2 bg-[#090d16] text-white">
              <input type="hidden" name="teamId" value={team.id} />
              <input type="hidden" name="redirectTo" value={`/equipos/${team.id}`} />
              <CarValidationProvider>
                <div className="space-y-2 text-left">
                  <label className="block text-xs text-slate-350 uppercase tracking-wider font-semibold">
                    {t.configTitle}
                  </label>
                  <p className="text-[11px] text-slate-400">
                    {t.configHint}
                  </p>
                  <TeamCarsEditor
                    teamMembers={teamMembersOptions}
                    initialCars={team.cars || []}
                    takenDorsals={takenDorsals}
                    leaguesOptions={leaguesOptions}
                    currentTeamId={team.id}
                  />
                </div>
                <SaveTeamCarsButton />
              </CarValidationProvider>
            </form>
          </CenterModal>
        )}
      </div>

      <div className="space-y-6">
        {['GT3', 'LMP2', 'HYPERCAR'].map((category) => {
          const categoryCars = (team.cars || []).filter((car: any) => String(car.category || '').toUpperCase() === category.toUpperCase())
          const theme = CATEGORY_THEMES[category] || DEFAULT_THEME

          // Cars beyond the 3-per-category-per-championship cap (see MAX_CARS_PER_CATEGORY)
          // may still sit in the DB from before the limit existed, or from a league change —
          // flag the 4th-and-later car in each championship group so it's clear it can't race.
          const leagueCarCounts: Record<string, number> = {}
          const excessCarIds = new Set<string>()
          categoryCars.forEach((car: any) => {
            const key = car.leagueId || 'general'
            leagueCarCounts[key] = (leagueCarCounts[key] || 0) + 1
            if (leagueCarCounts[key] > MAX_CARS_PER_CATEGORY) excessCarIds.add(car.id)
          })

          return (
            <div key={category} className={`border p-4 rounded-lg space-y-4 transition-all duration-300 ${theme.glow}`}>
              <h3 className={`text-sm font-black uppercase italic tracking-wider border-b pb-2 flex items-center justify-between ${theme.text} ${theme.line}`}>
                <span>{category}</span>
                <span className={`text-[10px] font-mono not-italic px-2.5 py-0.5 rounded-lg border font-bold tracking-normal ${theme.badge}`}>
                  {categoryCars.length} {categoryCars.length === 1 ? t.vehicleOne : t.vehicleMany}
                </span>
              </h3>

              {categoryCars.length === 0 ? (
                <p className="text-xs text-slate-500 italic">{t.noVehicles}</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {categoryCars.map((car: any) => {
                    const exceedsLimit = excessCarIds.has(car.id)
                    const carLeague = car.leagueId ? leagues.find((l) => l.id === car.leagueId || l.slug === car.leagueId) : null
                    const maxSlots = MAX_DRIVERS_PER_CAR
                    const effectiveLeagueKey = car.leagueId || carLeague?.id || carLeague?.slug || 'general'
                    const byLeague = car.driverUserIdsByLeague || car.driver_user_ids_by_league || {}
                    const leagueDriverList = byLeague[effectiveLeagueKey] || byLeague[carLeague?.id || ''] || byLeague[carLeague?.slug || '']

                    let carDriverUserIds: string[] = []
                    if (Array.isArray(leagueDriverList) && leagueDriverList.length > 0) {
                      carDriverUserIds = leagueDriverList.filter(Boolean).map(String)
                    } else if (Array.isArray(car.driverUserIds) && car.driverUserIds.length > 0) {
                      carDriverUserIds = car.driverUserIds.filter(Boolean).map(String)
                    } else if (Array.isArray(car.driver_user_ids) && car.driver_user_ids.length > 0) {
                      carDriverUserIds = car.driver_user_ids.filter(Boolean).map(String)
                    }

                    const carDriverSteamIds = !isAdmin ? [] : carDriverUserIds
                      .slice(0, maxSlots)
                      .map((dId: string) => {
                        const driver = teamMembersOptions.find((m) => m.userId === dId)
                        return driver?.steamId || driver?.userId?.replace('steam_', '') || ''
                      })
                      .filter(Boolean)

                    const steamIdEntries: CarSteamIdEntry[] = !isAdmin ? [] : carDriverUserIds
                      .slice(0, maxSlots)
                      .map((dId: string) => {
                        const m = teamMembersOptions.find((x) => x.userId === dId)
                        return { name: m?.name || '', steamId: m?.steamId || m?.userId?.replace('steam_', '') || '' }
                      })
                      .filter((x: CarSteamIdEntry) => x.steamId)
                    {
                      const reserveByLeagueIds = car.reserveDriverUserIdsByLeague || car.reserve_driver_user_ids_by_league || {}
                      const reserveIds =
                        reserveByLeagueIds[effectiveLeagueKey] ||
                        reserveByLeagueIds[carLeague?.id || ''] ||
                        reserveByLeagueIds[carLeague?.slug || ''] ||
                        car.reserveDriverUserIds ||
                        car.reserve_driver_user_ids ||
                        []
                      const rId = Array.isArray(reserveIds) && reserveIds[0] ? String(reserveIds[0]).trim() : null
                      const rm = rId ? teamMembersOptions.find((x) => x.userId === rId) : null
                      const rSteam = rm ? rm.steamId || rm.userId?.replace('steam_', '') || '' : ''
                      if (isAdmin && rm && rSteam) steamIdEntries.push({ name: rm.name, steamId: rSteam, reserve: true })
                    }

                    return (
                      <div
                        key={car.id}
                        className={`border bg-black/40 p-4 rounded-lg space-y-3 transition-all duration-300 ${
                          exceedsLimit ? 'border-rose-500/70 bg-rose-950/20' : theme.carBorder
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono-data text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-1.5">
                                {t.carNumber}{' '}
                                <span
                                  className={`font-mono-data shrink-0 rounded-md border px-2.5 py-1 text-sm font-black ${
                                    exceedsLimit
                                      ? 'border-rose-500/30 bg-rose-950/30 text-rose-400'
                                      : 'border-[#4ea1ff]/30 bg-[rgba(78,161,255,.12)] text-[#4ea1ff]'
                                  }`}
                                >
                                  #{car.dorsal || 'N/A'}
                                </span>
                              </span>
                              {(car.modelName || car.model_name) && (
                                <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 px-2 py-0.5 rounded font-mono">
                                  {car.modelName || car.model_name}
                                </span>
                              )}
                              {exceedsLimit && (
                                <span
                                  title={t.wontRaceHint}
                                  className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-400 bg-rose-950/60 border border-rose-500/40 px-2 py-0.5 rounded"
                                >
                                  <ShieldAlert className="h-3 w-3" />
                                  {t.wontRace}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                              <span className="text-slate-400 font-mono text-[10px] uppercase">{t.league}</span>
                              {carLeague ? (
                                <span className="text-cyan-400 bg-cyan-950/60 border border-cyan-500/40 px-2 py-0.5 font-black uppercase tracking-wide rounded-lg text-[10px]">
                                  {carLeague.title}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic bg-black/40 border border-white/10 px-2 py-0.5 text-[10px]">
                                  {t.allLeaguesGeneral}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isAdmin && (
                              <CopyVehicleDriverIdsButton
                                driverSteamIds={carDriverSteamIds}
                                className={theme.skinBtn}
                              />
                            )}
                            {car.skinUrl && (
                              <a
                                href={car.skinUrl}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors ${theme.skinBtn}`}
                              >
                                <Download className="h-3.5 w-3.5" />
                                {t.skin}
                              </a>
                            )}
                          </div>
                        </div>

                        <ViewCarSteamIds
                          entries={steamIdEntries}
                          className={theme.skinBtn}
                          labels={{ show: t.viewSteamIds, hide: t.hideSteamIds, reserve: t.reserve, copied: t.copiedShort }}
                        />

                        {/* Drivers slots */}
                        <div className={`border-t pt-2 ${theme.line}`}>
                          <div className={`grid gap-2 grid-cols-2 ${maxSlots > 2 ? 'md:grid-cols-4' : 'md:grid-cols-2'}`}>
                            {Array.from({ length: maxSlots }, (_, idx) => {
                              const effectiveLeagueKey = car.leagueId || carLeague?.id || carLeague?.slug || 'general'
                              const byLeague = car.driverUserIdsByLeague || car.driver_user_ids_by_league || {}
                              const leagueDriverList = byLeague[effectiveLeagueKey] || byLeague[carLeague?.id || ''] || byLeague[carLeague?.slug || '']

                              let driverId: string | null = null
                              if (Array.isArray(leagueDriverList) && leagueDriverList.length > 0) {
                                driverId = leagueDriverList[idx] || null
                              } else if (Array.isArray(car.driverUserIds)) {
                                driverId = car.driverUserIds[idx] || null
                              }

                              const cleanDriverId = (driverId && String(driverId).trim() !== '') ? String(driverId).trim() : null
                              const driverObj = cleanDriverId ? teamMembersOptions.find((m) => m.userId === cleanDriverId) : null
                              const driverName = driverObj?.name || null

                              return (
                                <div
                                  key={idx}
                                  className={`px-2.5 py-1.5 text-[10px] rounded-lg border flex items-center justify-between gap-1.5 min-w-0 ${
                                    driverName
                                      ? `${theme.driverActive} font-semibold`
                                      : 'border-dashed border-slate-800 bg-transparent text-slate-500 italic'
                                  }`}
                                >
                                  <span className="truncate">
                                    {driverName || t.vacant}
                                  </span>
                                </div>
                              )
                            })}
                          </div>

                          {(() => {
                            const reserveByLeague = car.reserveDriverUserIdsByLeague || car.reserve_driver_user_ids_by_league || {}
                            const reserveList =
                              reserveByLeague[effectiveLeagueKey] ||
                              reserveByLeague[carLeague?.id || ''] ||
                              reserveByLeague[carLeague?.slug || ''] ||
                              car.reserveDriverUserIds ||
                              car.reserve_driver_user_ids ||
                              []
                            const reserveId = Array.isArray(reserveList) && reserveList[0] ? String(reserveList[0]).trim() : null
                            const reserveDriver = reserveId ? teamMembersOptions.find((m) => m.userId === reserveId) : null
                            if (!reserveDriver) return null
                            return (
                              <div className="mt-2 flex items-center gap-1.5">
                                <span className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-300">
                                  {t.reserve}
                                </span>
                                <span className="truncate text-[10px] font-semibold text-amber-200/90">{reserveDriver.name}</span>
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </article>
  )
}
