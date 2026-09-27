import { describe, expect, it } from 'vitest'
import { sanitizeSettings } from '@/lib/discord-bot/config'

describe('saneado de los ajustes de soporte', () => {
  it('recorta texto y descarta ids que no parecen de Discord', () => {
    const result = sanitizeSettings({ panelTitle: '  Soporte RSX  ', categoryId: 'no-es-un-id', staffRoleIds: ['123456789012345', 'abc'] })
    expect(result.panelTitle).toBe('Soporte RSX')
    expect(result.categoryId).toBeNull()
    expect(result.staffRoleIds).toEqual(['123456789012345'])
  })

  it('quita duplicados y limita a 25 categorías de ticket', () => {
    const types = Array.from({ length: 30 }, (_, i) => ({ id: `t-${i}`, label: `Tipo ${i}` }))
    types.push({ id: 't-0', label: 'Duplicado' } as any)
    const result = sanitizeSettings({ ticketTypes: types })
    expect(result.ticketTypes).toHaveLength(25)
    expect(result.ticketTypes.filter((t) => t.id === 't-0')).toHaveLength(1)
  })

  it('descarta categorías de ticket sin nombre', () => {
    const result = sanitizeSettings({ ticketTypes: [{ id: 't-1', label: '  ' }, { id: 't-2', label: 'Válida' }] })
    expect(result.ticketTypes.map((t) => t.id)).toEqual(['t-2'])
  })

  it('valores por defecto cuando no llega nada', () => {
    const result = sanitizeSettings({})
    expect(result.panelTitle).toBe('Soporte')
    expect(result.embedColor).toBe('#1274de')
    expect(result.panelStyle).toBe('menu')
    expect(result.maxOpenTickets).toBe(1)
    expect(result.staffRoleIds).toEqual([])
  })

  it('limita máximo de tickets abiertos y minutos de recordatorio a su rango', () => {
    expect(sanitizeSettings({ maxOpenTickets: 99 }).maxOpenTickets).toBe(10)
    expect(sanitizeSettings({ maxOpenTickets: -5 }).maxOpenTickets).toBe(1)
    expect(sanitizeSettings({ reminderMinutes: 99999 }).reminderMinutes).toBe(1440)
  })
})
