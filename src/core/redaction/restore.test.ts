import { describe, expect, it } from 'vitest'
import type { Finding } from '../types'
import { applyRedactions } from './redact'
import { restorePlaceholders } from './restore'

describe('restorePlaceholders', () => {
  it('restores known placeholders', () => {
    const r = restorePlaceholders('Mail [EMAIL_1] and [EMAIL_1]', { '[EMAIL_1]': 'a@example.com' })
    expect(r).toEqual({ text: 'Mail a@example.com and a@example.com', restoredCount: 2, unknownPlaceholders: [] })
  })

  it('does not restore unknown placeholders and reports them', () => {
    const r = restorePlaceholders('[EMAIL_1] [PHONE_9] [PHONE_9]', { '[EMAIL_1]': 'x' })
    expect(r.text).toBe('x [PHONE_9] [PHONE_9]')
    expect(r.restoredCount).toBe(1)
    expect(r.unknownPlaceholders).toEqual(['[PHONE_9]'])
  })

  it('ignores prototype keys and non-placeholder brackets', () => {
    const r = restorePlaceholders('[constructor_1] [lower_1] [A]', {})
    expect(r.restoredCount).toBe(0)
    expect(r.unknownPlaceholders).toEqual([])
  })

  it('does not rescan restored values', () => {
    const r = restorePlaceholders('[A_1]', { '[A_1]': '[B_1]', '[B_1]': 'nope' })
    expect(r.text).toBe('[B_1]')
  })

  it('round-trips with applyRedactions', () => {
    const text = 'a x@example.com b y@example.com c x@example.com'
    const mk = (id: string, s: number, e: number): Finding => ({
      findingId: id, category: 'email', startOffset: s, endOffset: e, severity: 'medium', confidence: 1,
      detectorId: 'd', detectorVersion: '1', reasonCode: 'R', recommendedAction: 'redact', label: 'l',
      explanation: 'e', placeholderType: 'EMAIL', source: 'deterministic',
    })
    const fs = [mk('f-0', 2, 15), mk('f-1', 18, 31), mk('f-2', 34, 47)]
    const red = applyRedactions(text, fs, ['f-0', 'f-1', 'f-2'], 'typed', { structured: true })
    if (!red.ok) throw new Error('expected ok')
    expect(red.text).toBe('a [EMAIL_1] b [EMAIL_2] c [EMAIL_1]')
    const back = restorePlaceholders(red.text, red.mapping)
    expect(back.text).toBe(text)
    expect(back.restoredCount).toBe(3)
  })
})
