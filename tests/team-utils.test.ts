import { describe, expect, it } from 'vitest'

import { profileStatusMessage } from '@/app/equipos/[id]/team-utils'
import es from '@/lib/i18n/dictionaries/es'

const m = es.equipos.profileMessages

describe('profileStatusMessage — codigos de error de la alineacion', () => {
  it('lineup-locked-qualy-day muestra su propio mensaje, no el generico', () => {
    const msg = profileStatusMessage({ error: 'lineup-locked-qualy-day' }, m)
    expect(msg?.text).toBe(m.lineupLockedQualyDay)
    expect(msg?.text).not.toBe(m.actionFailed)
  })

  it('lineup-rate-limited muestra su propio mensaje, no el generico', () => {
    const msg = profileStatusMessage({ error: 'lineup-rate-limited' }, m)
    expect(msg?.text).toBe(m.lineupRateLimited)
    expect(msg?.text).not.toBe(m.actionFailed)
  })

  it('un codigo de error desconocido sigue cayendo en el mensaje generico', () => {
    const msg = profileStatusMessage({ error: 'algo-no-mapeado' }, m)
    expect(msg?.text).toBe(m.actionFailed)
  })
})
