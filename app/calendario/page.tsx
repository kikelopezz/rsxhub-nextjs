export const dynamic = 'force-dynamic'

import { getCurrentUser, getAdminAccessContext } from '@/lib/auth'
import { getLeagueEvents, getLeagues } from '@/lib/platform-data'
import CalendarContent from './calendar-content'

type ViewMode = 'month' | 'programme'

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function dateKeyUTC(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function parseDateInput(input?: string) {
  if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return new Date()
  return new Date(`${input}T00:00:00.000Z`)
}

function addDaysUTC(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function startOfMonthUTC(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function endOfMonthUTC(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
}

function startOfWeekUTC(date: Date) {
  const day = date.getUTCDay()
  const diff = (day + 6) % 7
  return addDaysUTC(date, -diff)
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>
}) {
  const session = await getCurrentUser()
  const access = await getAdminAccessContext(session?.userId)
  const isAdmin = access.canAccessPlatformAdmin

  const params = await searchParams
  const view: ViewMode = params.view === 'programme' ? 'programme' : 'month'
  const anchorDate = parseDateInput(params.date)

  const events = await getLeagueEvents()
  const leagues = await getLeagues()

  const monthStart = startOfMonthUTC(anchorDate)
  const monthEnd = endOfMonthUTC(anchorDate)
  const monthGridStart = startOfWeekUTC(monthStart)
  const monthGridEnd = addDaysUTC(startOfWeekUTC(monthEnd), 6)

  const prevMonth = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() - 1, 1))
  const nextMonth = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() + 1, 1))

  const weekStart = startOfWeekUTC(anchorDate)
  const prevWeek = addDaysUTC(weekStart, -7)
  const nextWeek = addDaysUTC(weekStart, 7)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysUTC(weekStart, i))
  const monthDays: Date[] = []
  for (let day = new Date(monthGridStart); day <= monthGridEnd; day = addDaysUTC(day, 1)) {
    monthDays.push(new Date(day))
  }

  // Map to serializable structures for Client Component boundary
  const serializableEvents = events.map(e => ({
    id: e.id,
    leagueId: e.leagueId,
    circuitId: e.circuitId ?? null,
    title: e.title ?? null,
    circuitName: e.circuitName,
    circuitImageUrl: e.circuitImageUrl ?? null,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    status: e.status,
    serverLink: e.serverLink ?? null,
    eventType: e.eventType ?? null,
    countryCode: e.countryCode ?? null,
    hasQualy: e.hasQualy ?? true,
    qualyStartsAt: e.qualyStartsAt ?? null,
    qualyEndsAt: e.qualyEndsAt ?? null,
  }))

  const serializableLeagues = leagues.map(l => ({
    id: l.id,
    title: l.title,
    slug: l.slug,
    simulator: l.simulator,
    accentColor: (l as any).accentColor || null,
  }))

  return (
    <CalendarContent
      initialEvents={serializableEvents}
      leagues={serializableLeagues}
      anchorDateStr={anchorDate.toISOString()}
      viewMode={view}
      isAdmin={isAdmin}
      monthDaysStr={monthDays.map(d => d.toISOString())}
      weekDaysStr={weekDays.map(d => d.toISOString())}
      prevMonthStr={prevMonth.toISOString()}
      nextMonthStr={nextMonth.toISOString()}
      prevWeekStr={prevWeek.toISOString()}
      nextWeekStr={nextWeek.toISOString()}
    />
  )
}
