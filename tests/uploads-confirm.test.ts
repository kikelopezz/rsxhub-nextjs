import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  isAdmin: false,
  deletedKeys: [] as string[],
  objectPrefix: null as Buffer | null,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: async () => ({ userId: 'u1' }),
  getAdminAccessContext: async () => ({ canAccessPlatformAdmin: store.isAdmin }),
}))
vi.mock('@/lib/r2', () => ({
  hasR2: true,
  getR2KeyFromUrl: (url: string) => {
    const prefix = 'https://cdn.example.com/'
    return url.startsWith(prefix) ? url.slice(prefix.length) : null
  },
  getR2ObjectPrefix: async () => store.objectPrefix,
  deleteFromR2: async (key: string) => {
    store.deletedKeys.push(key)
  },
}))

import { POST } from '@/app/api/uploads/confirm/route'

const req = (publicUrl: unknown, headers: Record<string, string> = { origin: 'http://localhost:3000' }) =>
  new Request('http://localhost:3000/api/uploads/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ publicUrl }),
  })

beforeEach(() => {
  store.isAdmin = false
  store.deletedKeys = []
  store.objectPrefix = null
})

describe('POST /api/uploads/confirm', () => {
  it('rejects requests without a trusted origin', async () => {
    const res = await POST(req('https://cdn.example.com/skins/a.zip', {}))
    expect(res.status).toBe(403)
  })

  it('rejects an invalid / foreign URL', async () => {
    const res = await POST(req('https://evil.example.com/skins/a.zip'))
    expect(res.status).toBe(400)
  })

  it('blocks non-admins from confirming admin-only folders', async () => {
    store.objectPrefix = Buffer.from([0x50, 0x4b, 0x03, 0x04])
    const res = await POST(req('https://cdn.example.com/coches/a.zip'))
    expect(res.status).toBe(403)
    expect(store.deletedKeys).toEqual([])
  })

  it('allows admins to confirm admin-only folders', async () => {
    store.isAdmin = true
    store.objectPrefix = Buffer.from([0x50, 0x4b, 0x03, 0x04])
    const res = await POST(req('https://cdn.example.com/coches/a.zip'))
    expect(res.status).toBe(200)
  })

  it('accepts a file whose bytes really match its extension', async () => {
    store.objectPrefix = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0])
    const res = await POST(req('https://cdn.example.com/skins/real.zip'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(store.deletedKeys).toEqual([])
  })

  it('deletes and rejects a file renamed to look like an archive', async () => {
    store.objectPrefix = Buffer.from('<html><script>alert(1)</script></html>')
    const res = await POST(req('https://cdn.example.com/skins/fake.zip'))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.ok).toBe(false)
    expect(store.deletedKeys).toEqual(['skins/fake.zip'])
  })

  it('rejects (without attempting a delete) when the object never landed in R2', async () => {
    store.objectPrefix = null
    const res = await POST(req('https://cdn.example.com/skins/missing.zip'))
    expect(res.status).toBe(400)
    expect(store.deletedKeys).toEqual([])
  })
})
