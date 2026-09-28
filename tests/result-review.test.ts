import { describe, expect, it } from 'vitest'


import { detectCar } from '@/lib/result-review'

const car = (over: Partial<{ teamName: string; dorsal: string | null; category: string | null; carModel: string | null }> = {}) => ({
  teamName: 'SpeedHackTeam',
  teamLogoUrl: null,
  dorsal: '14',
  category: 'HYPERCAR',
  carModel: 'Ferrari 499P',
  ...over,
})
const base = { steamId: '76561198000000001', classTag: 'HYPERCAR', storedTeam: 'SHT', storedDorsal: '1', registration: null }

describe('detección del coche por Steam ID', () => {
  it('toma el coche del equipo en la categoría de la fila', () => {
    const d = detectCar({ ...base, hub: [car()] })
    expect(d).toMatchObject({ teamName: 'SpeedHackTeam', dorsal: '14', carModel: 'Ferrari 499P', source: 'team-car' })
    expect(d.flags).toEqual(['file-differs'])
  })

  it('avisa si el coche del equipo es de otra categoría', () => {
    const d = detectCar({ ...base, classTag: 'GT3', hub: [car()] })
    expect(d.flags).toContain('category-mismatch')
  })

  it('avisa si el piloto es de un equipo pero no tiene coche', () => {
    const d = detectCar({ ...base, hub: [car({ dorsal: null, category: null, carModel: null })] })
    expect(d.source).toBe('team-member')
    expect(d.flags).toContain('no-car')
  })

  it('avisa si el Steam ID no está en ningún equipo y cae a lo que traía el archivo', () => {
    const d = detectCar({ ...base, hub: undefined })
    expect(d.flags).toContain('not-found')
    expect(d).toMatchObject({ source: 'file', teamName: 'SHT', dorsal: '1' })
  })

  it('avisa si el resultado no trae Steam ID', () => {
    expect(detectCar({ ...base, steamId: '', hub: undefined }).flags).toContain('no-steam')
  })

  it('avisa si tiene varios coches en la misma categoría', () => {
    const d = detectCar({ ...base, hub: [car(), car({ dorsal: '77' })] })
    expect(d.flags).toContain('multiple-cars')
  })

  it('si el Steam ID no está vinculado, lo busca por equipo+número en el resto de Equipos', () => {
    // El archivo trae el mismo equipo+número que un coche de Equipos, pero un Steam ID distinto
    // (todavía sin vincular) — debe encontrarlo igualmente por equipo+número.
    const d = detectCar({
      ...base,
      storedTeam: 'SpeedHackTeam',
      storedDorsal: '14',
      hub: undefined,
      hubFlat: [{ ...car(), steamId: '76561198999999999' }],
    })
    expect(d).toMatchObject({ teamName: 'SpeedHackTeam', dorsal: '14', carModel: 'Ferrari 499P', source: 'team-car' })
    expect(d.flags).toContain('not-found')
  })

  it('no usa equipo+número si el equipo o el número no coinciden', () => {
    const d = detectCar({
      ...base,
      storedTeam: 'SpeedHackTeam',
      storedDorsal: '14',
      hub: undefined,
      hubFlat: [{ ...car({ dorsal: '99' }), steamId: '76561198999999999' }],
    })
    expect(d.source).toBe('file')
  })
})
