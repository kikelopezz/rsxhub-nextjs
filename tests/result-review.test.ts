import { describe, expect, it } from 'vitest'


import { correlateRow, detectCar, type CorrelationContext } from '@/lib/result-review'

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

const ctx = (over: Partial<CorrelationContext> = {}): CorrelationContext => ({
  hub: {},
  hubFlat: [],
  entries: [],
  reviews: {},
  carModelCategory: {},
  ...over,
})

describe('correlación de una fila de resultados: Steam ID -> equipo -> coche -> categoría', () => {
  it('la categoría del coche del piloto en Equipos manda sobre la que trae el archivo', () => {
    const c = correlateRow(ctx({ hub: { '76561198000000001': [car({ category: 'LMP2', carModel: 'Oreca 07' })] } }), {
      steamId: '76561198000000001',
      classTag: 'GT3', // el archivo dice GT3, pero el equipo tiene a este piloto en un LMP2
    })
    expect(c.classTag).toBe('LMP2')
    expect(c.teamName).toBe('SpeedHackTeam')
  })

  it('sin equipo asignado, usa el modelo de coche del archivo para saber la categoría (Oreca 07 -> LMP2)', () => {
    const c = correlateRow(ctx(), { steamId: '76561198000000002', carModel: 'acf_oreca_07' })
    expect(c.classTag).toBe('LMP2')
  })

  it('sin equipo asignado, usa el mapa de modelos aprendido de la base de datos si el coche no está en la lista fija', () => {
    const c = correlateRow(ctx({ carModelCategory: { 'modelo personalizado 2024': 'GT4' } }), {
      steamId: '76561198000000003',
      carModel: 'Modelo Personalizado 2024',
    })
    expect(c.classTag).toBe('GT4')
  })

  it('con coches en varias categorías, el coche del archivo desempata cuál es', () => {
    const c = correlateRow(
      ctx({
        hub: {
          '76561198000000004': [car({ category: 'GT3', dorsal: '10' }), car({ category: 'LMP2', dorsal: '11', carModel: 'Oreca 07' })],
        },
      }),
      { steamId: '76561198000000004', carModel: 'acf_oreca_07' }
    )
    expect(c.classTag).toBe('LMP2')
    expect(c.dorsal).toBe('11')
  })

  it('sin equipo, sin coche en el archivo y sin categoría explícita, GT3 por defecto', () => {
    const c = correlateRow(ctx(), { steamId: '76561198000000005' })
    expect(c.classTag).toBe('GT3')
  })
})
