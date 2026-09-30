import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({ created: [] as any[], shouldThrow: false }))

vi.mock('@/lib/db', () => ({
  db: {
    auditLog: {
      create: async ({ data }: any) => {
        if (store.shouldThrow) throw new Error('db down')
        store.created.push(data)
      },
    },
  },
}))

import { logAudit } from '@/lib/audit-log'

beforeEach(() => {
  store.created = []
  store.shouldThrow = false
})

describe('logAudit', () => {
  it('writes the actor, action and entity fields', async () => {
    await logAudit({
      actor: { userId: 'u1', steamId: '765', steamDisplayName: 'Ana' },
      action: 'league.delete',
      entityType: 'league',
      entityId: 'lg1',
      entityLabel: 'ERC Next Gen',
      metadata: { soft: true },
    })
    expect(store.created).toEqual([
      {
        actorUserId: 'u1',
        actorSteamId: '765',
        actorLabel: 'Ana',
        action: 'league.delete',
        entityType: 'league',
        entityId: 'lg1',
        entityLabel: 'ERC Next Gen',
        metadata: { soft: true },
      },
    ])
  })

  it('falls back to a "system" actor label when there is no session', async () => {
    await logAudit({ actor: null, action: 'platform.reset_all' })
    expect(store.created[0].actorLabel).toBe('system')
    expect(store.created[0].actorUserId).toBeNull()
  })

  it('never throws, even if the write fails', async () => {
    store.shouldThrow = true
    await expect(logAudit({ actor: null, action: 'platform.reset_all' })).resolves.toBeUndefined()
  })
})
