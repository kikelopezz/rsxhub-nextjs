import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  event: { qualyCompleted: false, status: 'scheduled' as string },
  rows: [] as Array<{ id: string; userId: string; position: number; sessionType: string }>,
}))

vi.mock('@/lib/ttl-cache', () => ({
  // Sin caché real en el test: cada llamada vuelve a evaluar la puerta de publicación.
  fetchWithTTLCache: async (_key: string, fetcher: () => Promise<unknown>) => fetcher(),
  invalidateCache: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  db: {
    leagueEvent: { findUnique: async () => ({ ...store.event }) },
    leagueResult: { findMany: async ({ where }: any) => store.rows.filter((r) => r.sessionType === where.sessionType) },
    profile: { findMany: async () => [] },
    steamAccount: { findMany: async () => [] },
  },
}))
vi.mock('@/lib/team-data', () => ({ getTeamsDashboard: async () => ({ teams: [] }) }))
vi.mock('@/lib/result-review', async () => {
  const actual = await vi.importActual<typeof import('@/lib/result-review')>('@/lib/result-review')
  return {
    ...actual,
    loadCorrelationContext: async () => ({ hub: {}, entries: [], reviews: {} }),
  }
})
vi.mock('@/lib/auth', () => ({
  getCurrentUser: async () => ({ userId: 'admin', steamDisplayName: 'Admin' }),
  getAdminAccessContext: async () => ({ canAccessPlatformAdmin: true, managedLeagueIds: [] }),
  canStewardLeague: () => true,
}))

import { getEventResultsAction } from '@/app/ligas/actions/league-results'

describe('los resultados guardados no se ven hasta publicarse', () => {
  beforeEach(() => {
    store.event = { qualyCompleted: false, status: 'scheduled' }
    store.rows = [{ id: 'r1', userId: 'u1', position: 1, sessionType: 'qualifying' }]
  })

  it('con la sesión sin publicar, no devuelve nada aunque haya filas guardadas', async () => {
    expect(await getEventResultsAction('lg1', 'ev1', 'qualifying')).toEqual([])
  })

  it('en cuanto se publica (qualyCompleted), sí las devuelve', async () => {
    store.event.qualyCompleted = true
    const results = await getEventResultsAction('lg1', 'ev1', 'qualifying')
    expect(results).toHaveLength(1)
  })

  it('publicar la clasificación no hace visible la carrera, y viceversa', async () => {
    store.event = { qualyCompleted: true, status: 'scheduled' }
    store.rows = [{ id: 'r1', userId: 'u1', position: 1, sessionType: 'race' }]
    expect(await getEventResultsAction('lg1', 'ev1', 'race')).toEqual([])
  })
})
