import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  event: { id: 'ev1', leagueId: 'lg1', qualyCompleted: false, status: 'scheduled' as string, completedAt: null as Date | null },
  resultCount: 0,
  raceResults: [] as { userId: string; teamName: string | null; dorsal: string | null; classTag: string | null; points: number | null }[],
  registrations: [] as { userId: string; teamId: string | null; classTag?: string | null; assignedNumber?: number | null }[],
  // Estado real de las dos tablas, para poder comprobar que sumar no sustituye lo que ya había.
  teamPointsRows: new Map<string, { leagueId: string; classTag: string; teamId: string; carNumber: string; points: number; updatedBy?: string }>(),
  eventCarPointsRows: new Map<string, { leagueId: string; eventId: string; classTag: string; teamId: string; carNumber: string; points: number }>(),
  teamPointsUpserts: [] as any[],
}))

const teamPointsKey = (w: { leagueId: string; classTag: string; teamId: string; carNumber: string }) =>
  `${w.leagueId}|${w.classTag}|${w.teamId}|${w.carNumber}`
const eventCarPointsKey = (w: { leagueId: string; eventId: string; classTag: string; teamId: string; carNumber: string }) =>
  `${w.leagueId}|${w.eventId}|${w.classTag}|${w.teamId}|${w.carNumber}`

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/ttl-cache', () => ({ invalidateCache: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  canAccessPlatformAdmin: () => true,
  canStewardLeague: () => true,
  getCurrentUser: async () => ({ userId: 'admin' }),
  getLeagueRole: async () => 'owner',
  getPlatformRole: async () => 'admin',
}))
vi.mock('@/lib/db', () => ({
  db: {
    leagueEvent: {
      findUnique: async ({ where }: any) => (where.id === store.event.id ? { ...store.event } : null),
      update: async ({ data }: any) => {
        Object.assign(store.event, data)
        return store.event
      },
    },
    leagueResult: {
      count: async () => store.resultCount,
      findMany: async () => store.raceResults,
    },
    leagueRegistration: { findMany: async () => store.registrations },
    leagueEventCarPoints: {
      findMany: async ({ where }: any) => Array.from(store.eventCarPointsRows.values()).filter((r) => r.leagueId === where.leagueId && r.eventId === where.eventId),
      upsert: async ({ where, create, update }: any) => {
        const key = eventCarPointsKey(where.leagueId_eventId_classTag_teamId_carNumber)
        const existing = store.eventCarPointsRows.get(key)
        const row = existing ? { ...existing, ...update } : { ...create }
        store.eventCarPointsRows.set(key, row)
        return row
      },
    },
    leagueTeamPoints: {
      upsert: async (args: any) => {
        store.teamPointsUpserts.push(args)
        const { where, create, update } = args
        const key = teamPointsKey(where.leagueId_classTag_teamId_carNumber)
        const existing = store.teamPointsRows.get(key)
        if (existing) {
          existing.points += update.points?.increment ?? 0
          existing.updatedBy = update.updatedBy
          return existing
        }
        const row = { ...create }
        store.teamPointsRows.set(key, row)
        return row
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}))

import { POST } from '@/app/api/admin/publish-results/route'

function request(body: unknown) {
  return POST(new Request('http://localhost/api/admin/publish-results', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' }, body: JSON.stringify(body) }))
}

describe('publicar resultados', () => {
  beforeEach(() => {
    store.event = { id: 'ev1', leagueId: 'lg1', qualyCompleted: false, status: 'scheduled', completedAt: null }
    store.resultCount = 0
    store.raceResults = []
    store.registrations = []
    store.teamPointsRows = new Map()
    store.eventCarPointsRows = new Map()
    store.teamPointsUpserts = []
  })

  it('no deja publicar si no hay ningún resultado guardado', async () => {
    const res = await request({ leagueId: 'lg1', eventId: 'ev1', sessionType: 'qualifying' })
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('no-results-to-publish')
    expect(store.event.qualyCompleted).toBe(false)
  })

  it('publicar clasificación marca qualyCompleted, no el estado de la ronda', async () => {
    store.resultCount = 18
    const res = await request({ leagueId: 'lg1', eventId: 'ev1', sessionType: 'qualifying' })
    expect((await res.json()).ok).toBe(true)
    expect(store.event.qualyCompleted).toBe(true)
    expect(store.event.status).toBe('scheduled')
  })

  it('publicar carrera completa la ronda', async () => {
    store.resultCount = 20
    const res = await request({ leagueId: 'lg1', eventId: 'ev1', sessionType: 'race' })
    expect((await res.json()).ok).toBe(true)
    expect(store.event.status).toBe('completed')
    expect(store.event.completedAt).not.toBeNull()
  })

  it('da error si el evento no existe', async () => {
    const res = await request({ leagueId: 'lg1', eventId: 'no-existe', sessionType: 'race' })
    expect(res.status).toBe(404)
  })

  it('publicar carrera suma los puntos de la ronda al total de la clasificación de coches', async () => {
    store.resultCount = 2
    store.registrations = [{ userId: 'u1', teamId: 't1', classTag: 'GT3', assignedNumber: 7 }]
    store.raceResults = [
      { userId: 'u1', teamName: 'SHT', dorsal: '7', classTag: 'GT3', points: 25 },
      { userId: 'u1', teamName: 'SHT', dorsal: '7', classTag: 'GT3', points: 18 },
    ]
    await request({ leagueId: 'lg1', eventId: 'ev1', sessionType: 'race' })
    expect(store.teamPointsRows.get('lg1|GT3|t1|7')?.points).toBe(43)
  })

  it('NUNCA sustituye: si ya había puntos cargados (a mano o de otra ronda), la ronda los suma encima', async () => {
    store.resultCount = 1
    store.registrations = [{ userId: 'u1', teamId: 't1', classTag: 'GT3', assignedNumber: 7 }]
    store.raceResults = [{ userId: 'u1', teamName: 'SHT', dorsal: '7', classTag: 'GT3', points: 25 }]
    // Ya había 10 puntos en la clasificación antes de esta ronda (cargados a mano o por otra vía).
    store.teamPointsRows.set('lg1|GT3|t1|7', { leagueId: 'lg1', classTag: 'GT3', teamId: 't1', carNumber: '7', points: 10 })

    await request({ leagueId: 'lg1', eventId: 'ev1', sessionType: 'race' })

    expect(store.teamPointsRows.get('lg1|GT3|t1|7')?.points).toBe(35) // 10 que ya había + 25 de la ronda
  })

  it('publicar la misma ronda dos veces no duplica los puntos', async () => {
    store.resultCount = 1
    store.registrations = [{ userId: 'u1', teamId: 't1', classTag: 'GT3', assignedNumber: 7 }]
    store.raceResults = [{ userId: 'u1', teamName: 'SHT', dorsal: '7', classTag: 'GT3', points: 25 }]

    await request({ leagueId: 'lg1', eventId: 'ev1', sessionType: 'race' })
    store.event.status = 'scheduled' // simula volver a pulsar "Publicar" sobre la misma ronda
    await request({ leagueId: 'lg1', eventId: 'ev1', sessionType: 'race' })

    expect(store.teamPointsRows.get('lg1|GT3|t1|7')?.points).toBe(25)
  })

  it('corregir una ronda ya publicada ajusta solo la diferencia, no vuelve a sumar el total entero', async () => {
    store.resultCount = 1
    store.registrations = [{ userId: 'u1', teamId: 't1', classTag: 'GT3', assignedNumber: 7 }]
    store.raceResults = [{ userId: 'u1', teamName: 'SHT', dorsal: '7', classTag: 'GT3', points: 25 }]
    await request({ leagueId: 'lg1', eventId: 'ev1', sessionType: 'race' })
    expect(store.teamPointsRows.get('lg1|GT3|t1|7')?.points).toBe(25)

    // Se corrige la ronda: el piloto en realidad sumó 18, no 25.
    store.raceResults = [{ userId: 'u1', teamName: 'SHT', dorsal: '7', classTag: 'GT3', points: 18 }]
    store.event.status = 'scheduled'
    await request({ leagueId: 'lg1', eventId: 'ev1', sessionType: 'race' })

    expect(store.teamPointsRows.get('lg1|GT3|t1|7')?.points).toBe(18)
  })

  it('usa el número INSCRITO del piloto, no el dorsal de la carrera, para no escribir en un coche que la clasificación no lee', async () => {
    store.resultCount = 1
    // El piloto está inscrito con el #7, pero esta carrera la corrió con el #99 (coche/dorsal
    // distinto ese día) — los puntos deben ir a la fila del #7, que es la que se ve en la ficha.
    store.registrations = [{ userId: 'u1', teamId: 't1', classTag: 'GT3', assignedNumber: 7 }]
    store.raceResults = [{ userId: 'u1', teamName: 'SHT', dorsal: '99', classTag: 'GT3', points: 25 }]
    await request({ leagueId: 'lg1', eventId: 'ev1', sessionType: 'race' })
    expect(store.teamPointsRows.get('lg1|GT3|t1|7')?.points).toBe(25)
  })

  it('sin inscripción con equipo, no se le puede atribuir el coche a nadie: no escribe nada', async () => {
    store.resultCount = 1
    store.registrations = []
    store.raceResults = [{ userId: 'u-sin-equipo', teamName: null, dorsal: '5', classTag: 'GT3', points: 25 }]
    await request({ leagueId: 'lg1', eventId: 'ev1', sessionType: 'race' })
    expect(store.teamPointsUpserts).toHaveLength(0)
  })

  it('publicar clasificación (qualy) no toca la clasificación de coches', async () => {
    store.resultCount = 10
    store.registrations = [{ userId: 'u1', teamId: 't1', classTag: 'GT3', assignedNumber: 7 }]
    store.raceResults = [{ userId: 'u1', teamName: 'SHT', dorsal: '7', classTag: 'GT3', points: 25 }]
    await request({ leagueId: 'lg1', eventId: 'ev1', sessionType: 'qualifying' })
    expect(store.teamPointsUpserts).toHaveLength(0)
  })
})
