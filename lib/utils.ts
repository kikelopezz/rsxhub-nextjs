import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string) {
  if (!dateString) return '-'
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return dateString
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function formatDateTime(dateString: string) {
  if (!dateString) return '-'
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return dateString
  const dateFormatted = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${dateFormatted}, ${hours}:${minutes}`
}

// All race session times are entered by admins/stewards looking at Spanish wall-clock
// time, regardless of where the Node process actually runs (Vercel defaults its
// serverless functions to UTC) — so naive `new Date("2026-08-08T20:15:00")` parsing on
// the server silently shifts every session by the Madrid/UTC offset (1-2h depending on
// DST). These two helpers pin that conversion to a specific IANA zone instead of
// whatever timezone the host happens to be in.
export const LEAGUE_TIMEZONE = 'Europe/Madrid'

// Converts wall-clock date+time components entered in `timeZone` into the correct
// absolute UTC Date. Dependency-free: guesses the UTC instant, reads back what that
// guess looks like in the target zone via Intl, and corrects for the difference. Two
// passes are enough to converge even across a DST boundary.
export function zonedWallTimeToUtc(dateStr: string, timeStr: string, timeZone: string = LEAGUE_TIMEZONE): Date {
  const [year, month, day] = (dateStr || '').split('-').map(Number)
  const [hour, minute] = (timeStr || '').split(':').map(Number)
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    return new Date(NaN)
  }

  const targetUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0)
  let guess = targetUtcMs

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  for (let i = 0; i < 2; i++) {
    const parts = formatter.formatToParts(new Date(guess))
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0)
    const seenAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
    guess += targetUtcMs - seenAsUtc
  }

  return new Date(guess)
}

// The inverse — formats a UTC instant as a `YYYY-MM-DDTHH:mm` wall-clock string in
// `timeZone`, so an edit form re-shows the time the way an admin in that zone typed it
// (e.g. for a `<input type="datetime-local">` defaultValue).
export function utcToZonedDatetimeLocal(date: Date | string, timeZone: string = LEAGUE_TIMEZONE): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return ''

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = formatter.formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

export function simulatorLabel(sim: string) {
  if (sim === 'ac') return 'Assetto Corsa'
  if (sim === 'lmu') return 'Le Mans Ultimate'
  return sim
}

export function formatLabel(format: string) {
  const labels: Record<string, string> = {
    sprint: 'Sprint',
    endurance: 'Endurance',
    gt3: 'GT3',
    prototype: 'Prototypes',
    formula: 'Formula',
    multiclass: 'Multiclass',
  }
  return labels[format] ?? format
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    open: 'Open',
    ongoing: 'Ongoing',
    finished: 'Finished',
    draft: 'Draft',
  }
  return labels[status] ?? status
}
