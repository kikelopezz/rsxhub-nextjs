import { describe, expect, it } from 'vitest'
import { applicationIdFromToken, tokenHint } from '@/lib/discord-bot/token-store'

describe('token del bot de soporte (partes que no necesitan base de datos)', () => {
  it('decodifica el id de la aplicación del principio del token', () => {
    const id = '123456789012345678'
    const fakeToken = `${Buffer.from(id).toString('base64')}.fakemiddlepart.fakesignaturepart`
    expect(applicationIdFromToken(fakeToken)).toBe(id)
  })

  it('devuelve null si el principio del token no es un id válido', () => {
    expect(applicationIdFromToken('no-es-base64-valido.x.y')).toBeNull()
    expect(applicationIdFromToken(Buffer.from('no-numerico').toString('base64') + '.x.y')).toBeNull()
  })

  it('solo enseña los últimos 4 caracteres del token', () => {
    expect(tokenHint('abcdefghijklmnop.qrstuv.wxyz1234')).toBe('1234')
  })
})
