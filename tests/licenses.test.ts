import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_LIVE_TIMING_API_URL = 'https://license-source.example/leaderboard.json'
  process.env.STEAM_WEB_API_KEY = 'test-steam-key'
})

const upserts: unknown[] = []
vi.mock('@/lib/db', () => ({
  db: {
    driverLicense: {
      upsert: vi.fn(async (args: unknown) => {
        upserts.push(args)
      }),
    },
  },
}))

import { runLicenseCheck } from '@/lib/licenses'

const STEAM_ID = '76561198000000001'
const GT3_CAR = 'acf_aston_martin_vantage_gt3_evo'
const NS_PER_SEC = 1_000_000_000

function driver(guid: string, carModel: string, bestLapNs: number) {
  return {
    CarInfo: { DriverGUID: guid, CarModel: carModel },
    Cars: { [carModel]: { BestLap: bestLapNs } },
  }
}

function mockFetch(leaderboard: unknown, steamMinutes: number | null) {
  global.fetch = vi.fn(async (input: string | URL) => {
    const url = String(input)
    if (url.includes('steampowered.com')) {
      const body =
        steamMinutes == null
          ? { response: {} } // perfil/detalles de juego privados: Steam no manda la lista de juegos
          : { response: { games: [{ appid: 244210, playtime_forever: steamMinutes }] } }
      return new Response(JSON.stringify(body), { status: 200 })
    }
    return new Response(JSON.stringify(leaderboard), { status: 200 })
  }) as unknown as typeof fetch
}

describe('runLicenseCheck', () => {
  beforeEach(() => {
    upserts.length = 0
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('concede la licencia con el tiempo dentro del 107% y horas suficientes', async () => {
    const referenceBest = 90 * NS_PER_SEC
    mockFetch(
      {
        ConnectedDrivers: [driver('999', GT3_CAR, referenceBest)],
        DisconnectedDrivers: [driver(STEAM_ID, GT3_CAR, 92 * NS_PER_SEC)], // 102.2% del mejor
      },
      100 * 60 // 100 horas
    )

    const result = await runLicenseCheck('user1', STEAM_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.grantedClasses).toEqual(['GT3'])
    expect(upserts).toHaveLength(1)
  })

  it('NO concede la licencia si el tiempo está fuera del 107%, aunque tenga horas de sobra', async () => {
    const referenceBest = 90 * NS_PER_SEC
    mockFetch(
      {
        ConnectedDrivers: [driver('999', GT3_CAR, referenceBest)],
        DisconnectedDrivers: [driver(STEAM_ID, GT3_CAR, 100 * NS_PER_SEC)], // 111%, fuera
      },
      500 * 60
    )

    const result = await runLicenseCheck('user1', STEAM_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.grantedClasses).toEqual([])
    expect(result.results[0].withinPercent).toBe(false)
    expect(upserts).toHaveLength(0)
  })

  it('NO concede la licencia si el tiempo es válido pero no hay horas suficientes (hacen falta las DOS condiciones)', async () => {
    const referenceBest = 90 * NS_PER_SEC
    mockFetch(
      {
        ConnectedDrivers: [driver('999', GT3_CAR, referenceBest)],
        DisconnectedDrivers: [driver(STEAM_ID, GT3_CAR, 91 * NS_PER_SEC)], // dentro del 107%
      },
      10 * 60 // solo 10 horas
    )

    const result = await runLicenseCheck('user1', STEAM_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.results[0].withinPercent).toBe(true)
    expect(result.hoursOk).toBe(false)
    expect(result.grantedClasses).toEqual([])
    expect(upserts).toHaveLength(0)
  })

  it('no concede nada si no se pueden comprobar las horas (perfil de Steam privado)', async () => {
    const referenceBest = 90 * NS_PER_SEC
    mockFetch(
      {
        ConnectedDrivers: [driver('999', GT3_CAR, referenceBest)],
        DisconnectedDrivers: [driver(STEAM_ID, GT3_CAR, 91 * NS_PER_SEC)],
      },
      null // privado
    )

    const result = await runLicenseCheck('user1', STEAM_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.steamHours).toBeNull()
    expect(result.hoursOk).toBe(false)
    expect(result.grantedClasses).toEqual([])
  })

  it('devuelve un error claro si el servidor de licencias no responde', async () => {
    global.fetch = vi.fn(async () => new Response('', { status: 502 })) as unknown as typeof fetch

    const result = await runLicenseCheck('user1', STEAM_ID)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('license-server-unreachable')
  })
})
