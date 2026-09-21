import { describe, expect, it } from 'vitest'
import { archiveContentType, archiveMatchesExtension, detectRasterImage, detectSvg, safeHeaderFilename } from '@/lib/upload-validation'
import { rateLimit } from '@/lib/rate-limit'
import { safeRedirectPath } from '@/lib/safe-redirect'
import { toPublicTeamListing } from '@/lib/team-privacy'

const bytes = (...b: number[]) => Buffer.from(b)

describe('upload-validation', () => {
  it('recognises real images by their bytes', () => {
    expect(detectRasterImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.ext).toBe('.png')
    expect(detectRasterImage(bytes(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe('.jpg')
    expect(detectRasterImage(Buffer.from('GIF89a'))?.ext).toBe('.gif')
    expect(detectRasterImage(Buffer.concat([Buffer.from('RIFF'), bytes(0, 0, 0, 0), Buffer.from('WEBP')]))?.ext).toBe('.webp')
    expect(detectRasterImage(Buffer.concat([bytes(0, 0, 0, 0x20), Buffer.from('ftypavif')]))?.ext).toBe('.avif')
  })

  it('refuses anything that only claims to be an image', () => {
    expect(detectRasterImage(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull()
    expect(detectRasterImage(Buffer.from('<?php system($_GET[0]); ?>'))).toBeNull()
  })

  it('detects SVG separately (so it can be restricted to admins)', () => {
    expect(detectSvg(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))?.ext).toBe('.svg')
    expect(detectSvg(Buffer.from('<html><svg/></html>'))).toBeNull()
  })

  it('checks archive magic bytes against the extension', () => {
    expect(archiveMatchesExtension(bytes(0x50, 0x4b, 0x03, 0x04), 'a.zip')).toBe(true)
    expect(archiveMatchesExtension(bytes(0x50, 0x4b, 0x03, 0x04), 'a.rar')).toBe(false)
    expect(archiveMatchesExtension(bytes(0x1f, 0x8b, 8), 'a.tgz')).toBe(true)
    expect(archiveMatchesExtension(Buffer.from('not an archive'), 'a.zip')).toBe(false)
  })

  it('chooses the stored content type itself and keeps headers clean', () => {
    expect(archiveContentType('x.zip')).toBe('application/zip')
    expect(archiveContentType('x.tar.gz')).toBe('application/gzip')
    expect(safeHeaderFilename('a"b\r\nSet-Cookie: x.zip')).not.toMatch(/["\r\n]/)
  })
})

describe('rateLimit', () => {
  it('allows up to the limit inside the window, then blocks', () => {
    const key = `test:${Math.random()}`
    expect([1, 2, 3].map(() => rateLimit(key, 3, 60_000))).toEqual([true, true, true])
    expect(rateLimit(key, 3, 60_000)).toBe(false)
  })

  it('tracks keys independently', () => {
    const a = `a:${Math.random()}`
    expect(rateLimit(a, 1, 60_000)).toBe(true)
    expect(rateLimit(a, 1, 60_000)).toBe(false)
    expect(rateLimit(`b:${Math.random()}`, 1, 60_000)).toBe(true)
  })
})

describe('safeRedirectPath', () => {
  it('keeps same-site paths', () => {
    expect(safeRedirectPath('/equipos/abc')).toBe('/equipos/abc')
    expect(safeRedirectPath('/equipos?mode=x')).toBe('/equipos?mode=x')
    // real team ids are cuids full of letters (including "r"); they must not be mistaken for control characters
    expect(safeRedirectPath('/equipos/cmtkqkhns0023uqvsvgrdatga')).toBe('/equipos/cmtkqkhns0023uqvsvgrdatga')
    expect(safeRedirectPath('/perfil')).toBe('/perfil')
  })

  it('falls back for anything that could leave the site', () => {
    for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', '/a\r\nb', '', undefined, null, 42]) {
      expect(safeRedirectPath(bad)).toBe('/equipos')
    }
    expect(safeRedirectPath('//evil.com', '/perfil')).toBe('/perfil')
  })
})

describe('toPublicTeamListing', () => {
  it('drops invites, cars and members private ids before the page reaches the browser', () => {
    const team = {
      id: 't1',
      name: 'Team',
      invites: [{ invitedSteamId: '7656119', message: 'private' }],
      cars: [{ driverUserIds: ['u1'] }],
      members: [{ id: 'm1', role: 'owner', displayName: 'Ana', steamDisplayName: 'ana', avatarUrl: null, userId: 'u1', steamId: '7656119' }],
    }
    const out = toPublicTeamListing(team as any) as any
    expect(out.invites).toEqual([])
    expect(out.cars).toEqual([])
    expect(out.members[0]).toEqual({ id: 'm1', role: 'owner', displayName: 'Ana', steamDisplayName: 'ana', avatarUrl: null })
    expect(JSON.stringify(out)).not.toContain('7656119')
  })
})
