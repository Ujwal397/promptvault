import { describe, expect, it } from 'vitest'
import { barLabel, tokenizeSanitized } from './redactionTokens'

const bar = (placeholder: string) => ({ kind: 'bar' as const, placeholder, label: barLabel(placeholder) })
const text = (value: string) => ({ kind: 'text' as const, text: value })

describe('barLabel', () => {
  it('drops the brackets', () => {
    expect(barLabel('[EMAIL_1]')).toBe('EMAIL_1')
  })

  it('leaves a label without brackets as it is', () => {
    expect(barLabel('EMAIL_1')).toBe('EMAIL_1')
  })
})

describe('tokenizeSanitized', () => {
  it('returns the text unchanged when there are no replacements', () => {
    expect(tokenizeSanitized('hello', [])).toEqual([text('hello')])
  })

  it('returns no tokens for empty output', () => {
    expect(tokenizeSanitized('', [])).toEqual([])
  })

  it('draws a placeholder at the start of the text', () => {
    // Original "x@y.io and more": the first 6 characters are replaced.
    const tokens = tokenizeSanitized('[EMAIL_1] and more', [{ start: 0, end: 6, placeholder: '[EMAIL_1]' }])
    expect(tokens).toEqual([bar('[EMAIL_1]'), text(' and more')])
  })

  it('keeps the offset shift when a placeholder is longer than the value it replaces', () => {
    // Original "a@b.io and c@d.io!"; the second value sits after a 3-character growth.
    const sanitized = '[EMAIL_1] and [EMAIL_2]!'
    const tokens = tokenizeSanitized(sanitized, [
      { start: 0, end: 6, placeholder: '[EMAIL_1]' },
      { start: 11, end: 17, placeholder: '[EMAIL_2]' },
    ])
    expect(tokens).toEqual([bar('[EMAIL_1]'), text(' and '), bar('[EMAIL_2]'), text('!')])
  })

  it('handles adjacent placeholders', () => {
    const tokens = tokenizeSanitized('[X_1][X_2]', [
      { start: 0, end: 1, placeholder: '[X_1]' },
      { start: 1, end: 2, placeholder: '[X_2]' },
    ])
    expect(tokens).toEqual([bar('[X_1]'), bar('[X_2]')])
  })

  it('keeps a literal lookalike the user typed as plain text', () => {
    // The user typed "[EMAIL_1] " before the address, so the factory issued EMAIL_2.
    const tokens = tokenizeSanitized('[EMAIL_1] [EMAIL_2]', [{ start: 10, end: 16, placeholder: '[EMAIL_2]' }])
    expect(tokens).toEqual([text('[EMAIL_1] '), bar('[EMAIL_2]')])
  })

  it('accepts replacements given out of order', () => {
    const tokens = tokenizeSanitized('[A_1] and [B_1]', [
      { start: 6, end: 7, placeholder: '[B_1]' },
      { start: 0, end: 1, placeholder: '[A_1]' },
    ])
    expect(tokens).toEqual([bar('[A_1]'), text(' and '), bar('[B_1]')])
  })

  it('falls back to plain text when a replacement does not match the output', () => {
    const tokens = tokenizeSanitized('nope', [{ start: 0, end: 3, placeholder: '[X_1]' }])
    expect(tokens).toEqual([text('nope')])
  })

  it('falls back to plain text for an inverted span', () => {
    const tokens = tokenizeSanitized('abc', [{ start: 2, end: 1, placeholder: '[X_1]' }])
    expect(tokens).toEqual([text('abc')])
  })

  it('reproduces the sanitized text exactly when its bars are re-joined as brackets', () => {
    // Original: 'Key sk-ABCDEFGH for a@b.io, then c@d.io.' (synthetic values).
    const sanitized = 'Key [API_1] for [EMAIL_1], then [EMAIL_2].'
    const tokens = tokenizeSanitized(sanitized, [
      { start: 4, end: 15, placeholder: '[API_1]' },
      { start: 20, end: 26, placeholder: '[EMAIL_1]' },
      { start: 33, end: 39, placeholder: '[EMAIL_2]' },
    ])
    const rebuilt = tokens.map((t) => (t.kind === 'text' ? t.text : `[${t.label}]`)).join('')
    expect(rebuilt).toBe(sanitized)
  })
})
