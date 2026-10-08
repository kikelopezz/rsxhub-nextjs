import { describe, expect, it } from 'vitest'
import { sameCarNumber } from '@/app/ligas/[slug]/components/car-number-match'

describe('sameCarNumber', () => {
  it('matches a dorsal with leading zeros against the plain number stored in the confirmation', () => {
    expect(sameCarNumber('001', '1')).toBe(true)
    expect(sameCarNumber(1, '001')).toBe(true)
    expect(sameCarNumber('00', '0')).toBe(true)
    expect(sameCarNumber('007', 7)).toBe(true)
  })

  it('rejects genuinely different numbers', () => {
    expect(sameCarNumber('001', '2')).toBe(false)
    expect(sameCarNumber(12, 21)).toBe(false)
  })

  it('never matches when one side is not a number at all', () => {
    expect(sameCarNumber('abc', '0')).toBe(false)
    expect(sameCarNumber('7B', '7')).toBe(false)
  })
})
