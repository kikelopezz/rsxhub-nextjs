import { describe, expect, it } from 'vitest'
import { sameClassTag, canonicalClassTag } from '@/lib/class-tag-match'

describe('sameClassTag', () => {
  it('matches the Hypercar alias family regardless of spelling or case', () => {
    expect(sameClassTag('HYPERCAR', 'LMDH')).toBe(true)
    expect(sameClassTag('hypercar', 'lmh')).toBe(true)
    expect(sameClassTag('LMDH', 'LMH')).toBe(true)
  })

  it('matches any LMP* text as the same prototype class (existing behavior, preserved)', () => {
    expect(sameClassTag('LMP2', 'LMP')).toBe(true)
    expect(sameClassTag('LMP2', 'LMP3')).toBe(true)
  })

  it('matches identical GT text exactly, case-insensitive', () => {
    expect(sameClassTag('GT3', 'gt3')).toBe(true)
  })

  it('rejects genuinely different classes', () => {
    expect(sameClassTag('GT3', 'HYPERCAR')).toBe(false)
    expect(sameClassTag('GT3', 'LMP2')).toBe(false)
  })

  it('never matches when either side is empty', () => {
    expect(sameClassTag('', 'GT3')).toBe(false)
    expect(sameClassTag(null, 'GT3')).toBe(false)
    expect(sameClassTag('GT3', undefined)).toBe(false)
  })
})

describe('canonicalClassTag', () => {
  it('reduces the Hypercar alias family to one key', () => {
    expect(canonicalClassTag('HYPERCAR')).toBe('HYPERCAR')
    expect(canonicalClassTag('lmdh')).toBe('HYPERCAR')
    expect(canonicalClassTag('LMH')).toBe('HYPERCAR')
  })

  it('reduces any LMP* text to one key', () => {
    expect(canonicalClassTag('LMP2')).toBe('LMP')
    expect(canonicalClassTag('lmp3')).toBe('LMP')
  })

  it('leaves unrelated classes as their uppercased form', () => {
    expect(canonicalClassTag('gt3')).toBe('GT3')
  })
})
