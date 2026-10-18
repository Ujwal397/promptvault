import { describe, expect, it } from 'vitest'
import { ACTIONS, CATEGORIES, type EventRecord } from '../../core'
import {
  CHART_DAYS,
  DECISION_STACK,
  RECENT_SCAN_LIMIT,
  buildHistoryView,
  chartMax,
  computeStats,
  dayBuckets,
  describeBucket,
  recentScans,
  segmentPercent,
  topCategories,
  utcDay,
  windowDays,
} from './historyModel'

const NOW = new Date('2026-10-18T13:45:00Z')

function rec(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    schemaVersion: 1,
    kind: 'simulation',
    day: '2026-10-18',
    policyId: 'strict',
    policyVersion: '1.0.0',
    coreVersion: '1.0.0',
    status: 'completed',
    decision: 'redact',
    riskBand: 'medium',
    categoryCounts: {},
    findingCount: 0,
    validationPassed: null,
    ...overrides,
  }
}

const OCT_WINDOW = [
  '2026-10-05',
  '2026-10-06',
  '2026-10-07',
  '2026-10-08',
  '2026-10-09',
  '2026-10-10',
  '2026-10-11',
  '2026-10-12',
  '2026-10-13',
  '2026-10-14',
  '2026-10-15',
  '2026-10-16',
  '2026-10-17',
  '2026-10-18',
]

describe('day windows', () => {
  it('buckets by the UTC day, so the late evening local time does not move a record', () => {
    expect(utcDay(new Date('2026-10-18T23:59:59Z'))).toBe('2026-10-18')
    expect(utcDay(new Date('2026-10-19T00:00:00Z'))).toBe('2026-10-19')
  })

  it('returns 14 UTC days ending today, oldest first', () => {
    expect(windowDays(NOW)).toEqual(OCT_WINDOW)
    expect(windowDays(NOW)).toHaveLength(CHART_DAYS)
  })

  it('crosses month and year boundaries', () => {
    const days = windowDays(new Date('2027-01-02T10:00:00Z'))
    expect(days[0]).toBe('2026-12-20')
    expect(days).toContain('2026-12-31')
    expect(days).toContain('2027-01-01')
    expect(days[days.length - 1]).toBe('2027-01-02')
  })
})

describe('dayBuckets', () => {
  it('zero-fills every day when there are no records', () => {
    const buckets = dayBuckets([], NOW)
    expect(buckets.map((b) => b.day)).toEqual(OCT_WINDOW)
    expect(buckets.every((b) => b.total === 0)).toBe(true)
    expect(chartMax(buckets)).toBe(0)
  })

  it('counts scans by decision per day and ignores submissions', () => {
    const buckets = dayBuckets(
      [
        rec({ day: '2026-10-18', decision: 'redact' }),
        rec({ day: '2026-10-18', decision: 'block' }),
        rec({ day: '2026-10-18', decision: 'redact' }),
        rec({ day: '2026-10-17', decision: 'warn' }),
        rec({ day: '2026-10-17', kind: 'submission', decision: 'block' }),
      ],
      NOW,
    )
    const today = buckets[buckets.length - 1]
    const yesterday = buckets[buckets.length - 2]
    expect(today.counts).toEqual({ allow: 0, warn: 0, redact: 2, review: 0, block: 1 })
    expect(today.total).toBe(3)
    expect(yesterday.counts).toEqual({ allow: 0, warn: 1, redact: 0, review: 0, block: 0 })
    expect(yesterday.total).toBe(1)
    expect(chartMax(buckets)).toBe(3)
  })

  it('leaves out records outside the window', () => {
    const buckets = dayBuckets(
      [rec({ day: '2026-09-30' }), rec({ day: '2026-10-19' })],
      NOW,
    )
    expect(buckets.every((b) => b.total === 0)).toBe(true)
  })

  it('stacks every decision exactly once', () => {
    expect([...DECISION_STACK].sort()).toEqual([...ACTIONS].sort())
  })
})

describe('segmentPercent', () => {
  it('scales against the busiest day', () => {
    expect(segmentPercent(1, 4)).toBe(25)
    expect(segmentPercent(4, 4)).toBe(100)
  })

  it('never divides by zero', () => {
    expect(segmentPercent(0, 0)).toBe(0)
    expect(segmentPercent(3, 0)).toBe(0)
  })
})

describe('computeStats', () => {
  it('is zero, or null for the rate, with no records', () => {
    expect(computeStats([], null)).toEqual({
      scans: 0,
      copied: 0,
      itemsCaught: 0,
      blocked: 0,
      rescanPassRate: null,
    })
  })

  it('counts scans, items and blocks, and counts submissions only as copies', () => {
    const stats = computeStats(
      [
        rec({ decision: 'block', findingCount: 4 }),
        rec({ decision: 'redact', findingCount: 2 }),
        rec({ kind: 'submission', decision: 'block', findingCount: 5 }),
      ],
      null,
    )
    expect(stats).toEqual({ scans: 2, copied: 1, itemsCaught: 6, blocked: 1, rescanPassRate: null })
  })

  it('passes the re-scan rate through unchanged', () => {
    expect(computeStats([], 0.5).rescanPassRate).toBe(0.5)
  })
})

describe('topCategories', () => {
  it('is empty when nothing was caught', () => {
    expect(topCategories([rec()])).toEqual([])
  })

  it('sums scan categories, ignores submissions and sets shares against the largest', () => {
    const tallies = topCategories([
      rec({ categoryCounts: { email: 2, credential: 1 } }),
      rec({ categoryCounts: { email: 1 } }),
      rec({ kind: 'submission', categoryCounts: { email: 9 } }),
    ])
    expect(tallies).toHaveLength(2)
    expect(tallies[0]).toEqual({ category: 'email', count: 3, share: 1 })
    expect(tallies[1].category).toBe('credential')
    expect(tallies[1].count).toBe(1)
    expect(tallies[1].share).toBeCloseTo(1 / 3)
  })

  it('breaks ties in the CATEGORIES order and drops zero counts', () => {
    const tallies = topCategories([rec({ categoryCounts: { person_name: 2, email: 2, phone: 0 } })])
    expect(tallies.map((t) => t.category)).toEqual(['email', 'person_name'])
  })

  it('keeps only the top entries', () => {
    const counts = Object.fromEntries(CATEGORIES.slice(0, 7).map((c, i) => [c, 7 - i]))
    const tallies = topCategories([rec({ categoryCounts: counts })])
    expect(tallies).toHaveLength(5)
    expect(tallies[0].count).toBe(7)
    expect(tallies[4].count).toBe(3)
  })
})

describe('recentScans', () => {
  it('is empty without scan records', () => {
    expect(recentScans([rec({ kind: 'submission' })])).toEqual([])
  })

  it('lists the newest day first, and the latest insert first within a day', () => {
    // Stored oldest first. findingCount tells the rows apart.
    const rows = recentScans([
      rec({ day: '2026-10-16', findingCount: 1 }),
      rec({ day: '2026-10-18', findingCount: 2 }),
      rec({ day: '2026-10-18', findingCount: 3 }),
      rec({ day: '2026-10-17', findingCount: 4 }),
    ])
    expect(rows.map((r) => r.findingCount)).toEqual([3, 2, 4, 1])
    expect(rows.map((r) => r.day)).toEqual(['2026-10-18', '2026-10-18', '2026-10-17', '2026-10-16'])
  })

  it('keeps unknown risk and re-scan values as null, and residuals as false', () => {
    const rows = recentScans([
      rec({ riskBand: null, validationPassed: null }),
      rec({ riskBand: 'high', validationPassed: false }),
    ])
    expect(rows[0]).toMatchObject({ riskBand: 'high', validationPassed: false })
    expect(rows[1]).toMatchObject({ riskBand: null, validationPassed: null })
  })

  it('stops at the limit', () => {
    const many = Array.from({ length: 12 }, (_, i) => rec({ findingCount: i }))
    expect(recentScans(many)).toHaveLength(RECENT_SCAN_LIMIT)
  })

  it('does not change the records it reads', () => {
    const records = [rec({ findingCount: 1 }), rec({ findingCount: 2 })]
    const before = JSON.stringify(records)
    recentScans(records)
    expect(JSON.stringify(records)).toBe(before)
  })
})

describe('describeBucket', () => {
  it('lists the non-zero decisions in stack order', () => {
    const bucket = dayBuckets([rec({ decision: 'redact' }), rec({ decision: 'redact' }), rec({ decision: 'block' })], NOW)
    expect(describeBucket(bucket[bucket.length - 1])).toBe('1 blocked, 2 redacted')
  })

  it('says so for an empty day', () => {
    const bucket = dayBuckets([], NOW)
    expect(describeBucket(bucket[0])).toBe('No scans')
  })
})

describe('buildHistoryView', () => {
  it('returns a complete, empty view with no records', () => {
    const view = buildHistoryView([], null, NOW)
    expect(view.stats).toEqual({ scans: 0, copied: 0, itemsCaught: 0, blocked: 0, rescanPassRate: null })
    expect(view.buckets).toHaveLength(CHART_DAYS)
    expect(view.chartMax).toBe(0)
    expect(view.categories).toEqual([])
    expect(view.rows).toEqual([])
  })

  it('handles partial data: unknown risk, no re-scan, and no categories', () => {
    const view = buildHistoryView([rec({ riskBand: null, validationPassed: null, findingCount: 0 })], null, NOW)
    expect(view.stats.scans).toBe(1)
    expect(view.stats.rescanPassRate).toBeNull()
    expect(view.categories).toEqual([])
    expect(view.rows[0]).toMatchObject({ riskBand: null, validationPassed: null, findingCount: 0 })
    expect(view.chartMax).toBe(1)
  })
})
