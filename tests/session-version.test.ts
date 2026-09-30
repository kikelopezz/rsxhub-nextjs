import { describe, expect, it } from 'vitest'
import { isSessionVersionValid } from '@/lib/session-version'

describe('revocación de sesión por sessionVersion', () => {
  it('válida si la versión de la BD es igual a la del token', () => {
    expect(isSessionVersionValid(2, 2)).toBe(true)
  })

  it('válida si la versión de la BD es menor (no debería pasar, pero no revoca de más)', () => {
    expect(isSessionVersionValid(2, 1)).toBe(true)
  })

  it('inválida si la versión de la BD subió desde que se emitió el token', () => {
    expect(isSessionVersionValid(1, 2)).toBe(false)
  })

  it('token sin sessionVersion (emitido antes de este cambio): siempre válido', () => {
    expect(isSessionVersionValid(undefined, 5)).toBe(true)
  })

  it('fallo al leer la BD (null/undefined): nunca invalida por eso', () => {
    expect(isSessionVersionValid(1, null)).toBe(true)
    expect(isSessionVersionValid(1, undefined)).toBe(true)
  })
})
