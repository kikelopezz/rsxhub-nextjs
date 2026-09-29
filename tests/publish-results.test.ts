import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  event: { id: 'ev1', leagueId: 'lg1', qualyCompleted: false, status: 'scheduled' as string, completedAt: null as Date | null },
  resultCount: 0,
  raceResults: [] as { userId: string; teamName: string | null; dorsal: string | null; classTag: string | null; points: number | null }[],
  registrations: [] as { userId: string; teamId: string | null }[],
  teams: [] as { id: string; name: string }[],
  teamPointsUpserts: [] as any[],
}))

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
      // El evento ya se marcó 'completed' justo antes de esta llamada (misma petición)
      findMany: async () => (store.event.status === 'completed' ? store.raceResults : []),
    },
    leagueRegistration: { findMany: async () => store.registrations },
    team: { findMany: async () => store.teams },
    leagueTeamPoints: {
      upsert: async (args: any) => {
        store.teamPointsUpserts.push(args)
        return {}
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}))

import { POST } from '@/app/api/admin/publish-results/route'

function request(body: unknown) {
  return POST(new Request('http://localhost/api/admin/publish-results', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))
}

describe('publicar resultados', () => {
  beforeEach(() => {
    store.event = { id: 'ev1', leagueId: 'lg1', qualyCompleted: false, status: 'scheduled', completedAt: null }
    store.resultCount = 0
    store.raceResults = []
    store.registrations = []
    store.teams = []
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

  it('publicar carrera suma los puntos de todas las rondas ya publicadas en la clasificación de coches', async () => {
    store.resultCount = 2
    store.registrations = [{ userId: 'u1', teamId: 't1' }]
    // Dos rondas ya oficiales del mismo coche (equipo t1, dorsal 7, GT3): 25 + 18 puntos
    store.raceResults = [
      { userId: 'u1', teamName: 'SHT', dorsal: '7', classTag: 'GT3', points: 25 },
      { userId: 'u1', teamName: 'SHT', dorsal: '7', classTag: 'GT3', points: 18 },
    ]
    await request({ leagueId: 'lg1', eventId: 'ev1', sessionType: 'race' })
    expect(store.teamPointsUpserts).toHaveLength(1)
    expect(store.teamPointsUpserts[0].create).toMatchObject({ leagueId: 'lg1', classTag: 'GT3', teamId: 't1', carNumber: '7', points: 43 })
    expect(store.teamPointsUpserts[0].update).toMatchObject({ points: 43 })
  })

  it('publicar clasificación (qualy) no toca la clasificación de coches', async () => {
    store.resultCount = 10
    store.registrations = [{ userId: 'u1', teamId: 't1' }]
    store.raceResults = [{ userId: 'u1', teamName: 'SHT', dorsal: '7', classTag: 'GT3', points: 25 }]
    await request({ leagueId: 'lg1', eventId: 'ev1', sessionType: 'qualifying' })
    expect(store.teamPointsUpserts).toHaveLength(0)
  })
})
