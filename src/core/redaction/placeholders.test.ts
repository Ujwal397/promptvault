import { describe, expect, it } from 'vitest'
import { createPlaceholderFactory } from './placeholders'

describe('placeholder factory', () => {
  it('numbers distinct values and reuses for the same value', () => {
    const p = createPlaceholderFactory('typed', '')
    expect(p.get('EMAIL', 'a')).toBe('[EMAIL_1]')
    expect(p.get('EMAIL', 'b')).toBe('[EMAIL_2]')
    expect(p.get('EMAIL', 'a')).toBe('[EMAIL_1]')
    expect(p.get('PHONE', 'a')).toBe('[PHONE_1]')
  })
  it('skips numbers already present in the source', () => {
    const p = createPlaceholderFactory('typed', 'hi [EMAIL_1] and [EMAIL_2]')
    expect(p.get('EMAIL', 'x')).toBe('[EMAIL_3]')
  })
  it('mask mode ignores values', () => {
    const p = createPlaceholderFactory('mask', '')
    expect(p.get('EMAIL', 'a')).toBe('[REDACTED_EMAIL]')
    expect(p.get('EMAIL', 'b')).toBe('[REDACTED_EMAIL]')
  })
})
