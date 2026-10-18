import { CATEGORIES, type Category, type EventRecord, type PolicyAction, type RiskBand } from '../../core'
import { DECISION_LABELS } from './labels'

export const CHART_DAYS = 14
export const TOP_CATEGORY_LIMIT = 5
export const RECENT_SCAN_LIMIT = 10

const DAY_MS = 86_400_000

/** Bar segments from the top down: strictest first, allow as the baseline at the bottom. */
export const DECISION_STACK: readonly PolicyAction[] = ['block', 'review', 'redact', 'warn', 'allow']

export type DecisionCounts = Record<PolicyAction, number>

export interface DayBucket {
  /** UTC day, 'YYYY-MM-DD', the same bucket as EventRecord.day. */
  day: string
  counts: DecisionCounts
  total: number
}

export interface HistoryStats {
  /** Scan records (kind 'simulation'): a scan was run. */
  scans: number
  /** Submission records (kind 'submission'): a sanitized prompt was copied to send. */
  copied: number
  /** Items found across all scans. */
  itemsCaught: number
  /** Scans whose decision was block. */
  blocked: number
  /** Sanitize-validated records that re-scanned clean, 0 to 1. Null when none were validated. */
  rescanPassRate: number | null
}

export interface CategoryTally {
  category: Category
  count: number
  /** Count relative to the largest tally, 0 to 1. Drives the bar width. */
  share: number
}

export interface ScanRow {
  day: string
  decision: PolicyAction
  riskBand: RiskBand | null
  findingCount: number
  validationPassed: boolean | null
}

export interface HistoryView {
  stats: HistoryStats
  buckets: DayBucket[]
  chartMax: number
  categories: CategoryTally[]
  rows: ScanRow[]
}

/** The UTC day of a moment, the same rule the recorder uses for EventRecord.day. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/** The `count` UTC days ending on the day of `now`, oldest first. */
export function windowDays(now: Date, count: number = CHART_DAYS): string[] {
  const end = Date.parse(`${utcDay(now)}T00:00:00Z`)
  return Array.from({ length: count }, (_, i) => utcDay(new Date(end - (count - 1 - i) * DAY_MS)))
}

/** Scan records only. Each one is a scan that was run; submissions are counted separately. */
function scansOf(records: readonly EventRecord[]): EventRecord[] {
  return records.filter((r) => r.kind === 'simulation')
}

function emptyCounts(): DecisionCounts {
  return { allow: 0, warn: 0, redact: 0, review: 0, block: 0 }
}

/** One bucket per day of the window, zero-filled, counting scan records by decision. */
export function dayBuckets(records: readonly EventRecord[], now: Date, count: number = CHART_DAYS): DayBucket[] {
  const days = windowDays(now, count)
  const byDay = new Map(days.map((day) => [day, emptyCounts()] as const))
  for (const r of scansOf(records)) {
    const counts = byDay.get(r.day)
    if (counts) counts[r.decision] += 1
  }
  return days.map((day) => {
    const counts = byDay.get(day) ?? emptyCounts()
    return { day, counts, total: DECISION_STACK.reduce((sum, d) => sum + counts[d], 0) }
  })
}

export function chartMax(buckets: readonly DayBucket[]): number {
  return buckets.reduce((max, bucket) => Math.max(max, bucket.total), 0)
}

/** A decision segment's height as a percentage of the busiest day. Zero when there is nothing to scale. */
export function segmentPercent(count: number, max: number): number {
  return max > 0 ? (count / max) * 100 : 0
}

export function computeStats(records: readonly EventRecord[], rescanPassRate: number | null): HistoryStats {
  const scans = scansOf(records)
  let itemsCaught = 0
  let blocked = 0
  for (const r of scans) {
    itemsCaught += r.findingCount
    if (r.decision === 'block') blocked += 1
  }
  return {
    scans: scans.length,
    copied: records.filter((r) => r.kind === 'submission').length,
    itemsCaught,
    blocked,
    rescanPassRate,
  }
}

/** Most-caught categories across scans, largest first. Ties keep the CATEGORIES order. */
export function topCategories(records: readonly EventRecord[], limit: number = TOP_CATEGORY_LIMIT): CategoryTally[] {
  const totals = new Map<Category, number>()
  for (const r of scansOf(records)) {
    for (const category of CATEGORIES) {
      const n = r.categoryCounts[category] ?? 0
      if (n > 0) totals.set(category, (totals.get(category) ?? 0) + n)
    }
  }
  const ranked = CATEGORIES.flatMap((category) => {
    const count = totals.get(category) ?? 0
    return count > 0 ? [{ category, count }] : []
  }).sort((a, b) => b.count - a.count)
  const top = ranked.slice(0, limit)
  const max = top.length > 0 ? top[0].count : 0
  return top.map(({ category, count }) => ({ category, count, share: count / max }))
}

/**
 * Newest scans first. Records are stored oldest first, so same-day rows are reversed before a stable
 * sort by day. Records hold a day bucket only, so there is no time to order by.
 */
export function recentScans(records: readonly EventRecord[], limit: number = RECENT_SCAN_LIMIT): ScanRow[] {
  return scansOf(records)
    .reverse()
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, limit)
    .map(({ day, decision, riskBand, findingCount, validationPassed }) => ({
      day,
      decision,
      riskBand,
      findingCount,
      validationPassed,
    }))
}

/** One line for a bar's tooltip, such as "2 blocked, 1 redacted", or "No scans" for an empty day. */
export function describeBucket(bucket: DayBucket): string {
  const parts = DECISION_STACK.filter((d) => bucket.counts[d] > 0).map(
    (d) => `${bucket.counts[d]} ${DECISION_LABELS[d].toLowerCase()}`,
  )
  return parts.length > 0 ? parts.join(', ') : 'No scans'
}

/** Everything the History screen shows, derived from the validated records in one pass per part. */
export function buildHistoryView(
  records: readonly EventRecord[],
  rescanPassRate: number | null,
  now: Date,
): HistoryView {
  const buckets = dayBuckets(records, now)
  return {
    stats: computeStats(records, rescanPassRate),
    buckets,
    chartMax: chartMax(buckets),
    categories: topCategories(records),
    rows: recentScans(records),
  }
}
