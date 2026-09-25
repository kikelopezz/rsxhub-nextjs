import { beforeEach, describe, expect, it, vi } from 'vitest'

// Base de datos de mentira en memoria: solo lo que usa la ruta de importar resultados
type Result = { id: number; leagueId: string; eventId: string; sessionType: string; userId: string; position: number; classTag: string | null; [k: string]: unknown }
const store = vi.hoisted(() => ({ results: [] as Result[], nextId: 1, drivers: [] as { userId: string; steamId: string; classTag: string }[] }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/ttl-cache', () => ({ invalidateCache: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  canAccessPlatformAdmin: () => true,
  canStewardLeague: () => true,
  getCurrentUser: async () => ({ userId: 'admin' }),
  getLeagueRole: async () => 'owner',
  getPlatformRole: async () => 'admin',
}))
vi.mock('@/lib/db', () => {
  const matches = (row: Result, where: any): boolean => {
    const { OR, ...rest } = where
    if (OR && !OR.some((w: any) => matches(row, w))) return false
    return Object.entries(rest).every(([key, cond]: [string, any]) => {
      if (cond && typeof cond === 'object' && 'in' in cond) return cond.in.includes((row as any)[key])
      if (cond && typeof cond === 'object' && 'equals' in cond) {
        return String((row as any)[key] ?? '').toLowerCase() === String(cond.equals).toLowerCase()
      }
      return (row as any)[key] === cond
    })
  }
  return {
    db: {
      leagueEvent: {
        findUnique: async () => ({ id: 'ev1', leagueId: 'lg1' }),
        update: async () => ({}),
      },
      steamAccount: { findMany: async () => [] },
      user: { findMany: async () => [] },
      leagueRegistration: {
        findMany: async (args: any) =>
          store.drivers
            .filter((d) => (args.where.steamId ? args.where.steamId.in.includes(d.steamId) : args.where.userId.in.includes(d.userId)))
            .map((d) => ({ ...d, leagueId: 'lg1' })),
      },
      leagueResult: {
        deleteMany: async ({ where }: any) => {
          store.results = store.results.filter((r) => !matches(r, where))
        },
        createMany: async ({ data }: any) => {
          for (const row of data) store.results.push({ id: store.nextId++, ...row })
        },
      },
      leagueResultImport: { create: async () => ({}) },
    },
  }
})

import { POST } from '@/app/api/admin/import-results/route'

const drivers = (prefix: string, classTag: string, n: number) =>
  Array.from({ length: n }, (_, i) => {
    const steamId = `7656119${prefix}${String(i).padStart(10, '0')}`.slice(0, 17)
    store.drivers.push({ userId: `${prefix}${i}`, steamId, classTag })
    return steamId
  })

async function upload(ids: string[], classTag: string, sessionType = 'qualifying', extra: Record<string, string> = {}) {
  const payload = {
    eventId: 'ev1',
    sessionType,
    results: ids.map((id, i) => ({ DriverGuid: id, position: i + 1, overallPosition: i + 1, driverName: `Piloto ${i + 1}`, classTag, carNumber: String(i + 10) })),
  }
  const form = new FormData()
  form.append('leagueId', 'lg1')
  form.append('eventId', 'ev1')
  form.append('sessionType', sessionType)
  form.append('replaceExisting', 'on')
  form.append('resultsJsonText', JSON.stringify(payload))
  for (const [k, v] of Object.entries(extra)) form.append(k, v)
  const res = await POST(new Request('http://localhost/api/admin/import-results', { method: 'POST', headers: { 'x-requested-with': 'fetch' }, body: form }))
  return res.json()
}

describe('importar resultados por categoría', () => {
  beforeEach(() => {
    store.results = []
    store.nextId = 1
    store.drivers = []
  })

  it('guarda los 18 coches de GT3 (no solo 10) con su categoría', async () => {
    const gt3 = drivers('1', 'GT3', 18)
    const out = await upload(gt3, 'GT3')
    expect(out).toMatchObject({ ok: true, imported: 18, classTags: ['GT3'] })
    expect(store.results).toHaveLength(18)
    expect(store.results.every((r) => r.classTag === 'GT3')).toBe(true)
    expect(store.results[0]).toMatchObject({ driverName: 'Piloto 1', dorsal: '10', position: 1 })
  })

  it('subir LMP2 después no borra lo que ya estaba de GT3', async () => {
    await upload(drivers('1', 'GT3', 18), 'GT3')
    await upload(drivers('2', 'LMP2', 12), 'LMP2')
    expect(store.results.filter((r) => r.classTag === 'GT3')).toHaveLength(18)
    expect(store.results.filter((r) => r.classTag === 'LMP2')).toHaveLength(12)
  })

  it('volver a subir la misma categoría la reemplaza sin duplicar', async () => {
    const gt3 = drivers('1', 'GT3', 18)
    await upload(gt3, 'GT3')
    await upload(gt3.slice(0, 15), 'GT3')
    expect(store.results.filter((r) => r.classTag === 'GT3')).toHaveLength(15)
  })

  it('el máximo por categoría se puede ajustar (20, 25, 30…)', async () => {
    const gt3 = drivers('1', 'GT3', 28)
    expect((await upload(gt3, 'GT3', 'qualifying', { maxPerClass: '20' })).imported).toBe(20)
    expect((await upload(gt3, 'GT3', 'qualifying', { maxPerClass: '25' })).imported).toBe(25)
    expect((await upload(gt3, 'GT3', 'qualifying', { maxPerClass: '30' })).imported).toBe(28)
  })

  it('clasificación y carrera son independientes', async () => {
    const gt3 = drivers('1', 'GT3', 10)
    await upload(gt3, 'GT3', 'qualifying')
    await upload(gt3, 'GT3', 'race')
    expect(store.results.filter((r) => r.sessionType === 'qualifying')).toHaveLength(10)
    expect(store.results.filter((r) => r.sessionType === 'race')).toHaveLength(10)
  })
})
