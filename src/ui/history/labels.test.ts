import { describe, expect, it } from 'vitest'
import { ACTIONS, CATEGORIES, type RiskBand } from '../../core'
import {
  CATEGORY_LABELS,
  DECISION_LABELS,
  EMPTY_VALUE,
  RISK_LABELS,
  formatCount,
  formatDay,
  formatDayNumber,
  formatRate,
  rescanLabel,
} from './labels'

describe('labels', () => {
  it('names every decision, risk band and category', () => {
    for (const action of ACTIONS) expect(DECISION_LABELS[action].length).toBeGreaterThan(0)
    const bands: RiskBand[] = ['none', 'low', 'medium', 'high', 'critical']
    for (const band of bands) expect(RISK_LABELS[band].length).toBeGreaterThan(0)
    for (const category of CATEGORIES) expect(CATEGORY_LABELS[category].length).toBeGreaterThan(0)
  })

  it('uses plain words for the decisions the user sees', () => {
    expect(DECISION_LABELS.review).toBe('Needs review')
    expect(DECISION_LABELS.allow).toBe('Allowed')
  })
})

describe('formatDay', () => {
  it('formats a UTC day bucket as a short date', () => {
    expect(formatDay('2026-10-18')).toBe('Oct 18')
    expect(formatDay('2026-01-05')).toBe('Jan 5')
  })

  it('gives the day of the month for the chart axis', () => {
    expect(formatDayNumber('2026-10-05')).toBe('5')
    expect(formatDayNumber('2026-10-18')).toBe('18')
  })
})

describe('formatCount', () => {
  it('groups thousands', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(12345)).toBe('12,345')
  })
})

describe('formatRate', () => {
  it('shows the empty value when nothing was validated', () => {
    expect(formatRate(null)).toBe(EMPTY_VALUE)
    expect(EMPTY_VALUE).toBe('–')
  })

  it('formats whole percentages', () => {
    expect(formatRate(0)).toBe('0%')
    expect(formatRate(0.5)).toBe('50%')
    expect(formatRate(2 / 3)).toBe('67%')
    expect(formatRate(1)).toBe('100%')
  })

  it('never rounds up to 100% unless every record passed', () => {
    expect(formatRate(199 / 200)).toBe('99%')
  })
})

describe('rescanLabel', () => {
  it('maps passed, residuals and unknown', () => {
    expect(rescanLabel(true)).toBe('Passed')
    expect(rescanLabel(false)).toBe('Residuals found')
    expect(rescanLabel(null)).toBe(EMPTY_VALUE)
  })
})
