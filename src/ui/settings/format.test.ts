import { describe, expect, it } from 'vitest'
import { NOT_APPLICABLE, formatMs, formatPercent, retentionOptions } from './format'

describe('formatPercent', () => {
  it('shows null as n/a, never as zero', () => {
    expect(formatPercent(null)).toBe(NOT_APPLICABLE)
    expect(formatPercent(Number.NaN)).toBe(NOT_APPLICABLE)
  })

  it('keeps one decimal and drops a trailing .0', () => {
    expect(formatPercent(0.942)).toBe('94.2%')
    expect(formatPercent(0.907)).toBe('90.7%')
    expect(formatPercent(0.8)).toBe('80%')
    expect(formatPercent(1)).toBe('100%')
    expect(formatPercent(0)).toBe('0%')
  })

  it('never rounds a value below 100% up to 100%', () => {
    expect(formatPercent(0.9996)).toBe('99.9%')
  })

  it('marks tiny non-zero rates instead of showing 0%', () => {
    expect(formatPercent(0.0004)).toBe('<0.1%')
    expect(formatPercent(0.001)).toBe('0.1%')
  })
})

describe('formatMs', () => {
  it('shows null as n/a and otherwise two decimals', () => {
    expect(formatMs(null)).toBe(NOT_APPLICABLE)
    expect(formatMs(1.1)).toBe('1.10 ms')
    expect(formatMs(0)).toBe('0.00 ms')
  })
})

describe('retentionOptions', () => {
  it('offers the stored retention choices unchanged', () => {
    expect(retentionOptions(30)).toEqual([7, 30, 90, 365])
  })

  it('adds a stored value that is not a choice, in order, so the select never shows the wrong option', () => {
    expect(retentionOptions(45)).toEqual([7, 30, 45, 90, 365])
  })
})
