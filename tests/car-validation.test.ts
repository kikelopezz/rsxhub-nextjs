import { describe, expect, it } from 'vitest'

import { computeCarValidation, leaguesOverlap } from '@/components/team-cars-editor/car-validation'
import type { CarEntry, TakenDorsal } from '@/components/team-cars-editor/types'
import es from '@/lib/i18n/dictionaries/es'

const t = es.equipos.carEditor

const car = (over: Partial<CarEntry> = {}): CarEntry => ({
  id: 'car-1',
  category: 'GT3',
  dorsal: '44',
  modelName: 'Ferrari 296 GT3',
  skinUrl: '',
  driverUserIds: [],
  leagueId: 'league-1',
  ...over,
})

describe('computeCarValidation — dorsal unico por liga, no por categoria', () => {
  it('bloquea el mismo dorsal en dos categorias distintas de la MISMA liga (mismo equipo)', () => {
    const cars = [
      car({ id: 'a', category: 'HYPERCAR', dorsal: '44', leagueId: 'league-1' }),
      car({ id: 'b', category: 'GT3', dorsal: '44', leagueId: 'league-1' }),
    ]
    const errors = computeCarValidation(cars, [], 'team-1', t)
    expect(errors['a']).toBeDefined()
    expect(errors['b']).toBeDefined()
  })

  it('permite el mismo dorsal en la misma categoria si son de ligas DISTINTAS', () => {
    const cars = [
      car({ id: 'a', category: 'GT3', dorsal: '44', leagueId: 'league-RC' }),
      car({ id: 'b', category: 'GT3', dorsal: '44', leagueId: 'league-RC-nextgen' }),
    ]
    const errors = computeCarValidation(cars, [], 'team-1', t)
    expect(errors['a']).toBeUndefined()
    expect(errors['b']).toBeUndefined()
  })

  it('permite el mismo dorsal en categorias distintas si son de ligas DISTINTAS', () => {
    const cars = [
      car({ id: 'a', category: 'HYPERCAR', dorsal: '44', leagueId: 'league-RC' }),
      car({ id: 'b', category: 'GT3', dorsal: '44', leagueId: 'league-RC-nextgen' }),
    ]
    const errors = computeCarValidation(cars, [], 'team-1', t)
    expect(errors['a']).toBeUndefined()
    expect(errors['b']).toBeUndefined()
  })

  it('bloquea el dorsal si lo tiene OTRO equipo en otra categoria de la misma liga', () => {
    const cars = [car({ id: 'a', category: 'GT3', dorsal: '44', leagueId: 'league-1' })]
    const taken: TakenDorsal[] = [
      { teamId: 'team-2', teamName: 'Rival Team', category: 'HYPERCAR', dorsal: '44', leagueId: 'league-1' },
    ]
    const errors = computeCarValidation(cars, taken, 'team-1', t)
    expect(errors['a']).toBeDefined()
    expect(errors['a'][0]).toContain('#44')
  })

  it('no bloquea el dorsal de otro equipo si es de una liga distinta', () => {
    const cars = [car({ id: 'a', category: 'GT3', dorsal: '44', leagueId: 'league-RC' })]
    const taken: TakenDorsal[] = [
      { teamId: 'team-2', teamName: 'Rival Team', category: 'GT3', dorsal: '44', leagueId: 'league-RC-nextgen' },
    ]
    const errors = computeCarValidation(cars, taken, 'team-1', t)
    expect(errors['a']).toBeUndefined()
  })

  it('leaguesOverlap trata null/vacio como "todas las ligas" (siempre coincide)', () => {
    expect(leaguesOverlap(null, 'league-1')).toBe(true)
    expect(leaguesOverlap('league-1', null)).toBe(true)
    expect(leaguesOverlap('league-1', 'league-1')).toBe(true)
    expect(leaguesOverlap('league-1', 'league-2')).toBe(false)
  })
})
