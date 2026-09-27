import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  event: { id: 'ev1', leagueId: 'lg1', qualyCompleted: false, status: 'scheduled' as string, completedAt: null as Date | null },
  resultCount: 0,
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
    },
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
})
