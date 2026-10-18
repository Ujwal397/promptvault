import { describe, expect, it } from 'vitest'
import { maskSpan, maskValue } from './masking'

describe('maskValue', () => {
  it('returns an empty string for an empty value', () => {
    expect(maskValue('')).toBe('')
  })

  it('reveals nothing of a very short value', () => {
    expect(maskValue('x')).toBe('•••••')
    expect(maskValue('AB')).toBe('•••••')
  })

  it('shows one leading character for a short value', () => {
    expect(maskValue('Priya')).toBe('P•••••')
    expect(maskValue('ABCD')).toBe('A•••••')
  })

  it('shows a short prefix and suffix for a longer value', () => {
    expect(maskValue('Hunter2-demo')).toBe('Hu•••••o')
  })

  it('keeps a short prefix and suffix of a connection string and hides the middle', () => {
    const value = 'postgres://admin:Hunter2-demo@db.internal.example:5432/customers'
    const masked = maskValue(value)
    expect(masked).toBe('post•••••ers')
    expect(masked).not.toContain('Hunter2')
    expect(masked).not.toContain('admin')
  })

  it('keeps the domain of an email address and masks the local part', () => {
    expect(maskValue('priya.sharma@example.com')).toBe('pr•••••@example.com')
  })

  it('masks a one-letter email local part completely', () => {
    expect(maskValue('a@x.io')).toBe('•••••@x.io')
  })

  it('counts code points, not UTF-16 units', () => {
    expect(maskValue('\u{1F511}\u{1F511}\u{1F511}\u{1F511}\u{1F511}\u{1F511}')).toBe('\u{1F511}•••••')
  })

  it('never returns the whole value for any length', () => {
    for (let n = 1; n <= 60; n++) {
      const value = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + (i % 26))).join('')
      const masked = maskValue(value)
      expect(masked).not.toBe(value)
      expect(masked).toContain('•••••')
    }
  })
})

describe('maskSpan', () => {
  it('masks the text covered by a finding span', () => {
    const text = 'Key: sk-example-value-0001'
    expect(maskSpan(text, { startOffset: 5, endOffset: text.length })).toBe(maskValue('sk-example-value-0001'))
  })
})
