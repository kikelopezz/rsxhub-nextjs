import { describe, expect, it } from 'vitest'
import { channelNameFor, ticketCode } from '@/lib/discord-bot/naming'

describe('nombres de tickets de soporte', () => {
  it('numera el código con 3 dígitos', () => {
    expect(ticketCode('Incidente de carrera', 1)).toBe('Incidente de carrera 001')
    expect(ticketCode('Facturación', 42)).toBe('Facturación 042')
  })

  it('convierte el código en un nombre de canal válido para Discord', () => {
    expect(channelNameFor('Incidente de carrera 001')).toBe('incidente-de-carrera-001')
    expect(channelNameFor('Facturación 007')).toBe('facturacion-007')
  })

  it('nunca deja un nombre de canal vacío', () => {
    expect(channelNameFor('!!!')).toBe('ticket')
  })
})
