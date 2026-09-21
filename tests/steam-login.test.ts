import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildSteamAuthUrl, checkSteamAssertion, extractSteamId } from '@/lib/steam'

const APP = 'https://hub.example.com'
const STEAM_ID = '76561198000000001'
const CLAIMED = `https://steamcommunity.com/openid/id/${STEAM_ID}`

function assertion(overrides: Record<string, string> = {}) {
  return new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'id_res',
    'openid.op_endpoint': 'https://steamcommunity.com/openid/login',
    'openid.claimed_id': CLAIMED,
    'openid.identity': CLAIMED,
    'openid.return_to': `${APP}/api/auth/steam-callback?state=abc123`,
    'openid.signed': 'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
    'openid.response_nonce': 'nonce',
    ...overrides,
  })
}

const saved = { ...process.env }
beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = APP
  delete process.env.STEAM_REALM
  delete process.env.STEAM_RETURN_URL
  delete process.env.ALLOWED_AUTH_ORIGINS
})
afterEach(() => {
  process.env = { ...saved }
})

describe('buildSteamAuthUrl', () => {
  const returnTo = (url: string) => new URL(url).searchParams.get('openid.return_to')!

  it('uses the trusted origin and carries the state', () => {
    const url = buildSteamAuthUrl(undefined, null, 'st4te')
    expect(returnTo(url)).toBe(`${APP}/api/auth/steam-callback?state=st4te`)
    expect(new URL(url).searchParams.get('openid.realm')).toBe(`${APP}/`)
  })

  it('ignores an attacker-controlled ?origin=', () => {
    const url = buildSteamAuthUrl(undefined, 'https://evil.com', 's')
    expect(returnTo(url)).toContain(APP)
    expect(returnTo(url)).not.toContain('evil.com')
  })

  it('ignores an attacker-controlled X-Forwarded-Host / Host', () => {
    const request = new Request('https://evil.com/api/auth/steam', { headers: { 'x-forwarded-host': 'evil.com' } })
    expect(returnTo(buildSteamAuthUrl(request, null, 's'))).not.toContain('evil.com')
  })

  it('accepts an extra origin from ALLOWED_AUTH_ORIGINS', () => {
    process.env.ALLOWED_AUTH_ORIGINS = 'https://www.example.com'
    expect(returnTo(buildSteamAuthUrl(undefined, 'https://www.example.com', 's'))).toContain('https://www.example.com')
  })
})

describe('checkSteamAssertion', () => {
  it('accepts a well-formed assertion for this site and browser', () => {
    expect(checkSteamAssertion(assertion(), 'abc123')).toEqual({ ok: true })
  })

  it('rejects an assertion issued for another site (replay)', () => {
    const r = checkSteamAssertion(assertion({ 'openid.return_to': 'https://evil.com/api/auth/steam-callback?state=abc123' }), 'abc123')
    expect(r).toEqual({ ok: false, reason: 'untrusted-return-to' })
  })

  it('rejects a wrong callback path', () => {
    const r = checkSteamAssertion(assertion({ 'openid.return_to': `${APP}/somewhere-else?state=abc123` }), 'abc123')
    expect(r.ok).toBe(false)
  })

  it('rejects when the state does not match the browser cookie (login CSRF)', () => {
    expect(checkSteamAssertion(assertion(), 'other')).toEqual({ ok: false, reason: 'state-mismatch' })
    expect(checkSteamAssertion(assertion(), undefined)).toEqual({ ok: false, reason: 'state-mismatch' })
  })

  it('rejects identity mismatches, wrong mode and unsigned fields', () => {
    expect(checkSteamAssertion(assertion({ 'openid.identity': `${CLAIMED}9` }), 'abc123').ok).toBe(false)
    expect(checkSteamAssertion(assertion({ 'openid.mode': 'checkid_setup' }), 'abc123').ok).toBe(false)
    expect(checkSteamAssertion(assertion({ 'openid.signed': 'signed,op_endpoint' }), 'abc123').ok).toBe(false)
    expect(checkSteamAssertion(assertion({ 'openid.op_endpoint': 'https://evil.com/openid' }), 'abc123').ok).toBe(false)
  })
})

describe('extractSteamId', () => {
  it('only accepts 17-digit Steam IDs from the Steam claimed_id URL', () => {
    expect(extractSteamId(CLAIMED)).toBe(STEAM_ID)
    expect(extractSteamId('https://evil.com/openid/id/76561198000000001')).toBeNull()
    expect(extractSteamId(`${CLAIMED}/../x`)).toBeNull()
    expect(extractSteamId(null)).toBeNull()
  })
})
