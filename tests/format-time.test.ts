import { describe, expect, it } from 'vitest'
import { formatLapTime, formatMs } from '@/lib/format-time'

describe('formato de tiempos m:ss.mmm', () => {
  it('convierte milisegundos', () => {
    expect(formatLapTime('76451')).toBe('1:16.451')
    expect(formatLapTime(77204)).toBe('1:17.204')
    expect(formatLapTime('59999')).toBe('0:59.999')
  })

  it('convierte nanosegundos (live timing) y segundos con decimales', () => {
    expect(formatLapTime(76451000000)).toBe('1:16.451')
    expect(formatLapTime('76.451')).toBe('1:16.451')
  })

  it('deja como está lo que ya trae formato y marca lo que no es un tiempo', () => {
    expect(formatLapTime('1:16.451')).toBe('1:16.451')
    expect(formatLapTime(null)).toBe('—')
    expect(formatLapTime('')).toBe('—')
    expect(formatLapTime('0')).toBe('—')
  })

  it('usa horas en tiempos largos de carrera', () => {
    expect(formatMs(3_723_456)).toBe('1:02:03.456')
  })
})
