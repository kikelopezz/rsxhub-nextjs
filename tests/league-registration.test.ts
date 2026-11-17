import { describe, expect, it, vi } from 'vitest'

// Regresión del bug "AÑADIR EQUIPO AL CAMPEONATO" muestra el error genérico de Next
// ("An error occurred in the Server Components render...") en vez del motivo real: la
// action lanzaba un Error con mensaje útil, pero Next.js enmascara en producción
// cualquier cosa *lanzada* desde una Server Action. La action debe devolver
// `{ error }` en vez de lanzar, para que el mensaje llegue siempre al cliente.

vi.mock('@/lib/auth', () => ({
  getCurrentUser: async () => ({ userId: 'u1', steamDisplayName: 'Piloto' }),
}))

vi.mock('@/lib/platform-data', () => ({
  getRegistrations: async () => [],
  getLeagueBySlug: async () => null,
}))

vi.mock('@/lib/ttl-cache', () => ({ invalidateCache: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/data/categories', () => ({ getMinHoursForCategory: async () => 0 }))
vi.mock('@/lib/steam-hours', () => ({ getAssettoCorsaHours: async () => null }))

vi.mock('@/lib/db', () => ({
  db: {
    league: { findUnique: async () => ({ slug: 'test-league', classTags: ['GT3'], requiresPayment: false }) },
    team: {
      findUnique: async () => ({
        id: 'team1',
        status: 'approved',
        cars: [
          {
            id: 'car1',
            category: 'GT3',
            dorsal: '7',
            modelName: 'Ferrari 296',
            leagueId: null,
            drivers: [
              { userId: 'driver1', leagueId: null },
              { userId: 'driver2', leagueId: null },
            ],
          },
        ],
      }),
    },
    // Ninguno de los dos pilotos tiene Discord enlazado (connections: {}).
    profile: { findMany: async () => [{ userId: 'driver1', connections: {} }, { userId: 'driver2', connections: {} }] },
  },
}))

import { registerTeamAction } from '@/app/ligas/actions/league-registration'

describe('registerTeamAction', () => {
  it('devuelve { error } con el mensaje real en vez de lanzar, cuando falta el Discord de un piloto', async () => {
    const formData = new FormData()
    formData.set('leagueId', 'league1')
    formData.set('teamId', 'team1')
    formData.set('classTag', 'GT3')

    const result = await registerTeamAction(formData)

    expect(result).toBeDefined()
    expect(result?.error).toBe('Todos los pilotos del coche deben indicar su usuario de Discord en su perfil antes de inscribirse.')
  })
})
