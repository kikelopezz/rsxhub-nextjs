import Link from 'next/link'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { SectionTitle } from '@/components/section-title'
import {
  canAccessPlatformAdmin,
  canManageLeague,
  canStewardLeague,
  getCurrentUser,
  getLeagueRole,
  getPlatformRole,
} from '@/lib/auth'
import { getCircuits, getLeagueCars, getLeagueEvents, getLeagues, getRegistrations } from '@/lib/platform-data'
import { getFirestoreDb, hasFirebase } from '@/lib/firebase'
import { formatDateTime } from '@/lib/utils'
import { FormattedDate } from '@/components/formatted-date'
import {
  addLeagueCar,
  createEvent,
  removeLeagueCar,
  updateEvent,
  updateLeague,
  updateRegistrationStatus,
  updateTeamRegistrationStatus,
} from '../../actions'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

function toDatetimeLocal(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 16)
}

function durationMinutesForEvent(startsAt?: string | null, endsAt?: string | null) {
  if (!startsAt || !endsAt) return 60
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 60
  return Math.max(1, Math.round((end - start) / 60000))
}

function registrationStatusClass(status: string) {
  if (status === 'approved') return 'border-emerald-300/35 bg-emerald-500/20 text-emerald-100'
  if (status === 'rejected') return 'border-rose-300/35 bg-rose-500/20 text-rose-100'
  if (status === 'waitlist') return 'border-sky-300/35 bg-sky-500/20 text-sky-100'
  return 'border-amber-300/35 bg-amber-500/20 text-amber-100'
}

function statusLabel(status: string, t: { statusApproved: string; statusWaitlist: string; statusRejected: string; statusPending: string }) {
  if (status === 'approved') return t.statusApproved
  if (status === 'rejected') return t.statusRejected
  if (status === 'waitlist') return t.statusWaitlist
  return t.statusPending
}

export default async function AdminLeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    event?: string
    eventUpdated?: string
    updated?: string
    leagueUpdated?: string
    eventError?: string
    car?: string
    carDeleted?: string
    carError?: string
    classError?: string
    registrationModeError?: string
    leagueError?: string
    resultsImported?: string
    resultsUnresolved?: string
    resultsNotRegistered?: string
    resultsError?: string
  }>
}) {
  const session = await getCurrentUser()
  const { id } = await params
  const qs = await searchParams

  if (!session) redirect('/perfil')

  const t = getDictionary(await getLocale()).admin.leagueDetail
  const [platformRole, leagueRole] = await Promise.all([
    getPlatformRole(session.userId),
    getLeagueRole(id, session.userId),
  ])

  const isPlatformAdmin = canAccessPlatformAdmin(platformRole)
  const canManage = isPlatformAdmin || canManageLeague(leagueRole)
  const canReview = isPlatformAdmin || canStewardLeague(leagueRole)

  if (!canManage && !canReview) redirect('/admin')

  const leagues = await getLeagues()
  const league = leagues.find((item) => item.id === id)
  if (!league) notFound()

  const [events, leagueCars, registrations, circuits] = await Promise.all([
    getLeagueEvents(league.id),
    getLeagueCars(league.id),
    getRegistrations(league.id),
    getCircuits(),
  ])
  const db = getFirestoreDb()

  const teamInfoById = new Map<string, { name: string; primaryColor: string | null }>()
  const registrationTeamIds = Array.from(new Set(registrations.map((item) => item.teamId).filter(Boolean))) as string[]

  if (hasFirebase && db && registrationTeamIds.length > 0) {
    try {
      const chunks = []
      for (let i = 0; i < registrationTeamIds.length; i += 10) {
        chunks.push(registrationTeamIds.slice(i, i + 10))
      }
      const snaps = await Promise.all(chunks.map(chunk => db.collection('teams').where('__name__', 'in', chunk).get()))
      const teamsRes = snaps.flatMap((snap: any) => snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })))

      for (const row of teamsRes) {
        teamInfoById.set(row.id, { name: row.name || '', primaryColor: row.primary_color || null })
      }
    } catch (e) {
      console.error(e)
    }
  }

  const eventErrorText: Record<string, string> = t.eventErrors

  return (
    <div className="space-y-4 text-white">
      <section className="shell-panel p-4 md:p-5 rounded-lg">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle title={t.manageTitle.replace('{league}', league.title)} subtitle={t.manageSubtitle} />
          <div className="flex gap-2">
            {canManage ? (
              <a
                href={`/admin/ligas/${league.id}/export`}
                className="border border-shell-line bg-white/5 px-3 py-2 text-xs font-semibold text-white rounded-lg"
              >
                {t.exportIni}
              </a>
            ) : null}
            <Link href={`/admin/ligas/${league.id}/miembros`} className="border border-shell-line bg-white/5 px-3 py-2 text-xs font-semibold text-white rounded-lg">{t.members}</Link>
            <Link href="/admin" className="border border-shell-line bg-white/5 px-3 py-2 text-xs font-semibold text-white rounded-lg">{t.back}</Link>
          </div>
        </div>

        {qs.event === '1' ? <div className="border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 rounded-lg">{t.eventCreated}</div> : null}
        {qs.eventUpdated === '1' ? <div className="mt-2 border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 rounded-lg">{t.roundUpdated}</div> : null}
        {qs.car === '1' ? <div className="mt-2 border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 rounded-lg">{t.carAdded}</div> : null}
        {qs.carDeleted === '1' ? <div className="mt-2 border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 rounded-lg">{t.carDeleted}</div> : null}
        {qs.eventError ? <div className="mt-2 border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 rounded-lg">{eventErrorText[qs.eventError] || t.eventErrorGeneric}</div> : null}
        {qs.carError === 'create-failed' ? <div className="mt-2 border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 rounded-lg">{t.carErrorCreateFailed}</div> : null}
        {qs.updated === '1' ? <div className="mt-2 border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 rounded-lg">{t.registrationUpdated}</div> : null}
        {qs.leagueUpdated === '1' ? <div className="mt-2 border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 rounded-lg">{t.leagueUpdated}</div> : null}
        {qs.leagueError === 'update-failed' ? (
          <div className="mt-2 border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 rounded-lg">{t.leagueErrorUpdateFailed}</div>
        ) : null}
        {qs.resultsImported ? (
          <div className="mt-2 border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 rounded-lg">
            {t.resultsImported.replace('{n}', qs.resultsImported)}
            {qs.resultsUnresolved ? t.unresolvedUser.replace('{n}', qs.resultsUnresolved) : ''}
            {qs.resultsNotRegistered ? t.ignoredNotRegistered.replace('{n}', qs.resultsNotRegistered) : ''}
          </div>
        ) : null}
        {qs.resultsError === 'file-required' ? (
          <div className="mt-2 border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 rounded-lg">{t.resultsErrorFileRequired}</div>
        ) : null}
        {qs.resultsError === 'invalid-json' ? (
          <div className="mt-2 border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 rounded-lg">{t.resultsErrorInvalidJson}</div>
        ) : null}
        {qs.resultsError === 'event-required' ? (
          <div className="mt-2 border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 rounded-lg">{t.resultsErrorEventRequired}</div>
        ) : null}
        {qs.resultsError === 'event-not-found' ? (
          <div className="mt-2 border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 rounded-lg">{t.resultsErrorEventNotFound}</div>
        ) : null}
        {qs.resultsError === 'no-valid-rows' ? (
          <div className="mt-2 border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 rounded-lg">{t.resultsErrorNoValidRows}</div>
        ) : null}
        {qs.resultsError === 'no-resolved-users' ? (
          <div className="mt-2 border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 rounded-lg">{t.resultsErrorNoResolvedUsers}</div>
        ) : null}
        {qs.resultsError === 'no-registered-users' ? (
          <div className="mt-2 border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 rounded-lg">{t.resultsErrorNoRegisteredUsers}</div>
        ) : null}
        {qs.resultsError === 'insert-failed' ? (
          <div className="mt-2 border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 rounded-lg">{t.resultsErrorInsertFailed}</div>
        ) : null}
      </section>

      <section className="shell-panel p-4 md:p-5 rounded-lg">
        <SectionTitle title={t.configTitle} subtitle={t.configSubtitle} />
        {!canManage ? (
          <p className="text-sm text-slate-400">{t.reviewOnlyNote}</p>
        ) : (
          <form action={updateLeague} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 rounded-lg">
            <input type="hidden" name="leagueId" value={league.id} />
            <input name="title" defaultValue={league.title} placeholder={t.name} className="border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none rounded-lg" />
            <input name="slug" defaultValue={league.slug} placeholder={t.slug} className="border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none rounded-lg" />
            <select name="simulator" defaultValue={league.simulator} className="border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none rounded-lg">
              <option value="ac">Assetto Corsa</option>
              <option value="lmu">Le Mans Ultimate</option>
            </select>
            <select name="format" defaultValue={league.format} className="border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none rounded-lg">
              <option value="sprint">Sprint</option>
              <option value="endurance">Endurance</option>
              <option value="gt3">GT3</option>
              <option value="prototype">Prototype</option>
              <option value="formula">Formula</option>
              <option value="multiclass">Multiclass</option>
            </select>
            <input name="shortDescription" defaultValue={league.shortDescription} placeholder={t.shortDescription} className="border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none md:col-span-2 rounded-lg" />
            <input name="bannerUrl" defaultValue={league.bannerUrl || ''} placeholder={t.bannerUrl} className="border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none md:col-span-2 rounded-lg" />
            <textarea name="fullDescription" defaultValue={league.fullDescription} rows={2} placeholder={t.fullDescription} className="border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none md:col-span-2 rounded-lg" />
            <div className="border border-shell-line bg-black/20 px-3 py-2 text-sm text-white md:col-span-2 rounded-lg">
              <p className="mb-2 text-xs text-slate-300">{t.classesLabel}</p>
              <div className="flex flex-wrap gap-2">
                {['GT3', 'HYPERCAR', 'LMP2', 'GTE', 'F1', 'GT4'].map((tag) => (
                  <label key={tag} className="inline-flex cursor-pointer items-center gap-1 border border-white/20 bg-white/5 px-2 py-1 text-xs rounded-lg">
                    <input
                      type="checkbox"
                      name="classTags"
                      value={tag}
                      defaultChecked={Boolean(league.classTags?.includes(tag))}
                      className="accent-blue-500"
                    />
                    {tag}
                  </label>
                ))}
              </div>
              <p className="mt-3 mb-1 text-xs text-slate-300">{t.addClassesLabel}</p>
              <input
                name="customClassTags"
                defaultValue={(league.classTags || []).filter((tag) => !['GT3', 'HYPERCAR', 'LMP2', 'GTE', 'F1', 'GT4'].includes(tag)).join(', ')}
                placeholder={t.addClassesPlaceholder}
                className="w-full border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none rounded-lg"
              />
            </div>
            <select name="status" defaultValue={league.status} className="border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none rounded-lg">
              <option value="draft">{t.statusDraft}</option>
              <option value="open">{t.statusOpen}</option>
              <option value="ongoing">{t.statusOngoing}</option>
              <option value="finished">{t.statusFinished}</option>
            </select>
            <label className="flex items-center gap-2 border border-shell-line bg-black/20 px-3 py-2 text-xs text-slate-200 rounded-lg"><input type="checkbox" name="featured" defaultChecked={Boolean(league.featured)} /> {t.featured}</label>
            <label className="flex items-center gap-2 border border-shell-line bg-black/20 px-3 py-2 text-xs text-slate-200 rounded-lg"><input type="checkbox" name="registrationOpen" defaultChecked={Boolean(league.registrationOpen)} /> {t.openRegistration}</label>
            <select name="registrationMode" defaultValue={league.registrationMode || 'individual'} className="border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none rounded-lg">
              <option value="individual">{t.registrationModeIndividual}</option>
              <option value="team">{t.registrationModeTeam}</option>
            </select>
            <button className="bg-shell-accent px-4 py-2 text-sm font-bold text-white rounded-lg">{t.saveLeague}</button>
          </form>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="shell-panel p-4 md:p-5 rounded-lg">
          <SectionTitle title={t.carsAllowedTitle} subtitle={t.carsAllowedSubtitle} />
          <div className="space-y-2">
            {leagueCars.length === 0 ? <p className="text-sm text-slate-400">{t.noCarsConfigured}</p> : null}
            {leagueCars.map((car) => (
              <div key={car.id} className="flex items-center justify-between gap-2 border border-shell-line bg-black/20 px-3 py-2 rounded-lg">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{car.label}</p>
                  <p className="truncate text-xs text-slate-300">{car.model}</p>
                </div>
                {canManage ? (
                  <form action={removeLeagueCar}>
                    <input type="hidden" name="leagueId" value={league.id} />
                    <input type="hidden" name="carId" value={car.id} />
                    <button className="border border-rose-300/40 bg-rose-500/20 px-2 py-1 text-xs font-semibold text-rose-100 rounded-lg">{t.remove}</button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
          {canManage ? (
            <form action={addLeagueCar} className="mt-3 grid gap-2 md:grid-cols-3 rounded-lg">
              <input type="hidden" name="leagueId" value={league.id} />
              <input name="label" placeholder={t.labelPlaceholder} className="border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none rounded-lg" />
              <input name="model" placeholder={t.modelPlaceholder} className="border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none rounded-lg" />
              <div className="flex gap-2">
                <input name="sortOrder" type="number" defaultValue={0} className="w-full border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none rounded-lg" />
                <button className="bg-shell-accent px-3 py-2 text-xs font-bold text-white rounded-lg">{t.add}</button>
              </div>
            </form>
          ) : null}
        </div>

        <div className="shell-panel p-4 md:p-5 rounded-lg">
          <SectionTitle title={t.createEventTitle} subtitle={t.createEventSubtitle} />
          {!canManage ? (
            <p className="text-sm text-slate-400">{t.reviewOnlyCreateNote}</p>
          ) : (
            <form action={createEvent} className="space-y-3 rounded-lg">
              <input type="hidden" name="leagueId" value={league.id} />
              <input name="title" placeholder={t.roundTitlePlaceholder} className="w-full border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none rounded-lg" />
              <select name="circuitId" defaultValue="" className="w-full border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none rounded-lg">
                <option value="">{t.useManualCircuitName}</option>
                {circuits.map((circuit) => (
                  <option key={circuit.id} value={circuit.id}>
                    {circuit.name}
                  </option>
                ))}
                <option value="custom">{t.addCustomCircuit}</option>
              </select>
              <input name="circuitName" placeholder={t.manualCircuitPlaceholder} className="w-full border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none rounded-lg" />
              <input name="customCircuitName" placeholder={t.customCircuitNamePlaceholder} className="w-full border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none rounded-lg" />
              <input
                name="customCircuitImageUrl"
                placeholder={t.customCircuitImagePlaceholder}
                className="w-full border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none rounded-lg"
              />
              <div className="grid gap-3 md:grid-cols-2">
                <input name="startsAt" type="datetime-local" className="w-full border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none rounded-lg" />
                <input name="durationMinutes" type="number" min={1} defaultValue={60} placeholder={t.durationPlaceholder} className="w-full border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none rounded-lg" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">{t.eventMaxDriversLabel}</label>
                <input name="maxDrivers" type="number" min={1} placeholder={t.eventMaxDriversPlaceholder} className="w-full border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none rounded-lg" />
              </div>
              {(league.classTags || []).length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">{t.carsPerCategoryLabel}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(league.classTags || []).map((cat) => (
                      <div key={cat} className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">{cat}</span>
                        <input
                          name={`max_cars_${cat}`}
                          type="number"
                          min={1}
                          max={100}
                          defaultValue={(league as any).classLimits?.[cat] ?? 30}
                          className="w-full border border-shell-line bg-black/20 px-2 py-1.5 text-sm text-white outline-none rounded-lg"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <select name="status" className="w-full border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none rounded-lg">
                <option value="scheduled">{t.statusScheduled}</option>
                <option value="completed">{t.statusCompleted}</option>
                <option value="cancelled">{t.statusCancelled}</option>
              </select>
              <button className="bg-shell-accent px-4 py-2 text-sm font-bold text-white rounded-lg">{t.createEventButton}</button>
            </form>
          )}
        </div>

        <div className="shell-panel p-4 md:p-5 rounded-lg col-span-1 md:col-span-2">
          <SectionTitle title={t.currentEventsTitle} subtitle={t.currentEventsSubtitle} />
          {canReview ? (
            <div className="mb-3 border border-shell-line bg-black/20 p-3 text-xs text-slate-300 rounded-lg">
              <p className="mb-2 font-semibold text-white">{t.importFormatIntro}</p>
              <pre className="overflow-x-auto text-[11px] leading-relaxed text-slate-300">{`{
  "Result": [
    { "DriverGuid": "7656119...", "position": 1, "points": 25 }
  ]
}`}</pre>
              <p className="mt-2 text-[11px] text-slate-400">
                {t.importFormatNote}
              </p>
            </div>
          ) : null}
          <div className="space-y-2">
            {events.filter((event) => event.status !== 'cancelled').length === 0 ? (
              <p className="text-sm text-slate-400">{t.noEvents}</p>
            ) : (
              events
                .filter((event) => event.status !== 'cancelled')
                .map((event) => {
                  const raceTitle = event.title?.trim() || event.circuitName
                  const hasCustomRaceTitle = Boolean(event.title?.trim())
                  return (
                    <div key={event.id} className="border border-shell-line bg-black/20 p-3 rounded-lg">
                      <div className="flex gap-3">
                        <div className="h-16 w-24 overflow-hidden border border-shell-line bg-black/30 rounded-lg">
                          {event.circuitImageUrl ? (
                            <Image src={event.circuitImageUrl} alt={event.circuitName} width={96} height={64} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-slate-500">{t.noImage}</div>
                          )}
                        </div>
                        <div>
                          {hasCustomRaceTitle ? <p className="text-xs uppercase tracking-widest text-slate-400">{event.circuitName}</p> : null}
                          <p className="font-semibold text-white">{raceTitle}</p>
                          <p className="mt-1 text-xs text-slate-400"><FormattedDate date={event.startsAt} /></p>
                        </div>
                      </div>
                      {canManage ? (
                        <form action={updateEvent} className="mt-3 grid gap-2 md:grid-cols-6 rounded-lg">
                          <input type="hidden" name="leagueId" value={league.id} />
                          <input type="hidden" name="eventId" value={event.id} />
                          <input
                            name="title"
                            defaultValue={event.title}
                            placeholder={t.roundTitlePlaceholder2}
                            className="border border-shell-line bg-black/20 px-2 py-1.5 text-xs text-white outline-none rounded-lg"
                          />
                          <input
                            name="circuitName"
                            defaultValue={event.circuitName}
                            placeholder={t.circuitPlaceholder}
                            className="border border-shell-line bg-black/20 px-2 py-1.5 text-xs text-white outline-none rounded-lg"
                          />
                          <input
                            name="startsAt"
                            type="datetime-local"
                            defaultValue={toDatetimeLocal(event.startsAt)}
                            className="border border-shell-line bg-black/20 px-2 py-1.5 text-xs text-white outline-none rounded-lg"
                          />
                          <input
                            name="durationMinutes"
                            type="number"
                            min={1}
                            defaultValue={durationMinutesForEvent(event.startsAt, event.endsAt)}
                            placeholder={t.durationPlaceholder}
                            className="border border-shell-line bg-black/20 px-2 py-1.5 text-xs text-white outline-none rounded-lg"
                          />
                          <input
                            name="maxDrivers"
                            type="number"
                            min={1}
                            defaultValue={(event as any).maxDrivers ?? ''}
                            placeholder={t.eventMaxDriversPlaceholder}
                            className="border border-shell-line bg-black/20 px-2 py-1.5 text-xs text-white outline-none rounded-lg"
                          />
                          {(league.classTags || []).length > 0 && (
                            <div className="md:col-span-6 flex flex-wrap items-center gap-2">
                              <span className="text-[9px] uppercase font-bold text-slate-500">{t.carsPerCategoryLabel}:</span>
                              {(league.classTags || []).map((cat) => (
                                <div key={cat} className="flex items-center gap-1">
                                  <span className="text-[9px] font-bold text-slate-400">{cat}</span>
                                  <input
                                    name={`max_cars_${cat}`}
                                    type="number"
                                    min={1}
                                    max={100}
                                    defaultValue={(event as any).classLimits?.[cat] ?? (league as any).classLimits?.[cat] ?? 30}
                                    className="w-14 border border-shell-line bg-black/20 px-1.5 py-1 text-xs text-white outline-none rounded-lg"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <select
                              name="status"
                              defaultValue={event.status}
                              className="w-full border border-shell-line bg-black/20 px-2 py-1.5 text-xs text-white outline-none rounded-lg"
                            >
                              <option value="scheduled">{t.statusScheduled}</option>
                              <option value="completed">{t.statusCompleted}</option>
                              <option value="cancelled">{t.statusCancelled}</option>
                            </select>
                            <button className="bg-shell-accent px-3 py-1.5 text-xs font-bold text-white rounded-lg">{t.save}</button>
                          </div>
                        </form>
                      ) : null}
                      {canReview ? (
                        <form action="/api/admin/import-results" encType="multipart/form-data" method="post" className="mt-2 grid gap-2 md:grid-cols-[1fr_auto_auto] rounded-lg">
                          <input type="hidden" name="leagueId" value={league.id} />
                          <input type="hidden" name="eventId" value={event.id} />
                          <input
                            name="resultsFile"
                            type="file"
                            accept="application/json,.json"
                            required
                            className="w-full border border-shell-line bg-black/20 px-2 py-1.5 text-xs text-white outline-none file:mr-2 file:border-0 file:bg-shell-accent file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-white file:rounded-lg rounded-lg"
                          />
                          <label className="flex items-center gap-1 border border-shell-line bg-black/20 px-2 py-1.5 text-[11px] text-slate-300 rounded-lg">
                            <input type="checkbox" name="replaceExisting" defaultChecked />
                            {t.replace}
                          </label>
                          <button className="bg-shell-accent px-3 py-1.5 text-xs font-bold text-white rounded-lg">{t.uploadResultsJson}</button>
                        </form>
                      ) : null}
                    </div>
                  )
                })
            )}
          </div>
        </div>
      </section>

      <section className="shell-panel p-4 md:p-5 rounded-lg">
        <SectionTitle title={t.registrationsTitle} subtitle={t.registrationsSubtitle} />
        <div className="space-y-2">
          {registrations.length === 0 ? (
            <p className="text-sm text-slate-400">{t.noRegistrations}</p>
          ) : league.registrationMode === 'team' ? (
            Array.from(
              registrations.reduce((acc, registration) => {
                const key = registration.teamId
                  ? `${registration.teamId}::${registration.classTag || 'noclass'}::${typeof registration.assignedNumber === 'number' ? registration.assignedNumber : 'no-number'}`
                  : `solo-${registration.userId}`
                const current = acc.get(key) || []
                current.push(registration)
                acc.set(key, current)
                return acc
              }, new Map<string, typeof registrations>()),
            ).map(([key, members]) => {
              const first = members[0]
              const team = first?.teamId ? teamInfoById.get(first.teamId) : null
              const number = typeof first?.assignedNumber === 'number' ? String(first.assignedNumber) : '-'
              const bg = team?.primaryColor
                ? `linear-gradient(135deg, ${team.primaryColor}2A 0%, rgba(8,11,18,0.92) 55%)`
                : 'linear-gradient(135deg, rgba(18,116,222,0.18) 0%, rgba(8,11,18,0.92) 55%)'
              const primaryStatus = members.some((item) => item.status === 'approved')
                ? 'approved'
                : members.some((item) => item.status === 'waitlist')
                ? 'waitlist'
                : members.some((item) => item.status === 'rejected')
                ? 'rejected'
                : 'pending'

              return (
                <details key={key} className="overflow-hidden border border-shell-line rounded-lg" style={{ background: bg }}>
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">{team?.name || t.unnamedTeam}</p>
                      <p className="text-xs text-slate-300">
                        {t.carLabel.replace('{number}', number)}
                        {first?.classTag ? t.classLabel.replace('{tag}', first.classTag) : ''}
                        {t.driversLabel.replace('{n}', String(members.length))}
                      </p>
                    </div>
                    <span className={`border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] rounded-lg ${registrationStatusClass(primaryStatus)}`}>
                      {statusLabel(primaryStatus, t)}
                    </span>
                    {canReview && first?.teamId ? (
                      <div className="ml-1 flex gap-1">
                        {['approved', 'waitlist', 'rejected'].map((status) => (
                          <form key={`${key}-${status}`} action={updateTeamRegistrationStatus}>
                            <input type="hidden" name="leagueId" value={league.id} />
                            <input type="hidden" name="teamId" value={first.teamId || ''} />
                            <input type="hidden" name="classTag" value={first.classTag || '__NULL__'} />
                            <input type="hidden" name="carNumber" value={typeof first.assignedNumber === 'number' ? String(first.assignedNumber) : '0'} />
                            <input type="hidden" name="status" value={status} />
                            <button
                              className="border border-shell-line bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase text-white hover:bg-white/10 rounded-lg"
                            >
                              {statusLabel(status, t)}
                            </button>
                          </form>
                        ))}
                      </div>
                    ) : null}
                  </summary>

                  <div className="space-y-2 border-t border-shell-line bg-black/20 p-3 rounded-lg">
                    {members.map((registration) => (
                      <div key={registration.id} className="border border-shell-line bg-black/30 p-3 rounded-lg">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="font-semibold text-white">{registration.displayName}</p>
                            <p className="text-xs text-slate-300">{t.steamIdLabel} {registration.steamId}</p>
                            <p className="text-xs text-slate-300">{t.userIdLabel} {registration.userId}</p>
                            <p className="text-xs text-slate-300">{t.requestedLabel} <FormattedDate date={registration.createdAt} /></p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`border px-2 py-1 text-xs font-semibold uppercase rounded-lg ${registrationStatusClass(registration.status)}`}>
                              {statusLabel(registration.status, t)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )
            })
          ) : (
            registrations.map((registration) => (
              <div key={registration.id} className="border border-shell-line bg-black/20 p-3 rounded-lg">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-semibold text-white">{registration.displayName}</p>
                    <p className="text-xs text-slate-400">{t.steamIdLabel} {registration.steamId}</p>
                    <p className="text-xs text-slate-400">{t.requestedLabel} <FormattedDate date={registration.createdAt} /></p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="border border-shell-line bg-white/5 px-2 py-1 text-xs text-slate-200 rounded-lg">{statusLabel(registration.status, t)}</span>
                    {canReview
                      ? ['approved', 'waitlist', 'rejected'].map((status) => (
                          <form key={status} action={updateRegistrationStatus}>
                            <input type="hidden" name="registrationId" value={registration.id} />
                            <input type="hidden" name="leagueId" value={league.id} />
                            <input type="hidden" name="status" value={status} />
                            <button className="border border-shell-line bg-white/5 px-2 py-1 text-xs font-semibold uppercase text-white hover:bg-white/10 rounded-lg">{statusLabel(status, t)}</button>
                          </form>
                        ))
                      : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
