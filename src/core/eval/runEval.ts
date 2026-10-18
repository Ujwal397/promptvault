import { CORPUS_VERSION, type EvalCase } from './corpus'
import { f1Of, maskValue, percentile, precisionOf, ratio, recallOf } from './metrics'
import { matchSpans, resolveExpectation, type ResolvedExpectation } from './match'
import type { Category, Finding, PolicyAction, SanitizeResult, ScanResult } from '../types'

export interface EvalDeps {
  scan(text: string): ScanResult
  sanitize(text: string, scan: ScanResult): SanitizeResult
  /** Epoch milliseconds used for `generatedAt`. Defaults to Date.now. */
  now?: () => number
  /** Monotonic millisecond clock for latency. Defaults to performance.now, else Date.now. */
  clock?: () => number
}

export interface CaseOutcome {
  id: string
  split: EvalCase['split']
  tags: EvalCase['tags']
  expectedDecision: PolicyAction
  /** Null when the scan threw. */
  actualDecision: PolicyAction | null
  decisionCorrect: boolean
  tp: number
  fp: number
  fn: number
  /** Count of matched pairs whose start/end matched exactly (<= tp). */
  spanExact: number
  /** Null when nothing was expected. */
  redactionOk: boolean | null
  durationMs: number
  scanStatus: ScanResult['status']
  /** Values are masked (first chars + ellipsis). */
  missed: { category: Category; value: string }[]
  unexpected: { category: Category; detectorId: string }[]
}

export interface CategoryMetrics {
  tp: number
  fp: number
  fn: number
  precision: number | null
  recall: number | null
  f1: number | null
  support: number
}

export interface SplitMetrics {
  cases: number
  precision: number | null
  recall: number | null
  policyAccuracy: number | null
}

export interface EvalReport {
  corpusVersion: string
  generatedAt: string
  totals: { cases: number; tp: number; fp: number; fn: number; precision: number | null; recall: number | null; f1: number | null }
  perCategory: Partial<Record<Category, CategoryMetrics>>
  /** Exact-span matches / true positives. */
  spanAccuracy: number | null
  /** Cases whose decision equals expectedDecision / all cases. */
  policyAccuracy: number | null
  /** Successful redactions / cases that expected something. */
  redactionSuccess: number | null
  /** Negative-tagged cases whose decision was stricter than warn (redact, review or block) / negative cases. */
  falseBlockRate: number | null
  latency: { p50: number | null; p95: number | null; max: number | null }
  bySplit: Record<'dev' | 'heldout', SplitMetrics>
  cases: CaseOutcome[]
}

type CatCounts = Record<string, { tp: number; fp: number; fn: number }>

const defaultClock = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()

function bump(counts: CatCounts, category: Category, field: 'tp' | 'fp' | 'fn', by = 1): void {
  const entry = counts[category] ?? { tp: 0, fp: 0, fn: 0 }
  counts[category] = { ...entry, [field]: entry[field] + by }
}

function checkRedaction(c: EvalCase, scan: ScanResult, deps: EvalDeps): boolean {
  try {
    const result = deps.sanitize(c.text, scan)
    if (result.status !== 'completed' || result.sanitizedText === null || !result.validationPassed) return false
    const sanitized = result.sanitizedText
    return c.expected.every((e) => !sanitized.includes(e.value))
  } catch {
    return false
  }
}

interface CaseRun {
  outcome: CaseOutcome
  perCategory: CatCounts
}

function runCase(c: EvalCase, deps: EvalDeps, clock: () => number): CaseRun {
  const perCategory: CatCounts = {}
  const resolved: ResolvedExpectation[] = []
  const unresolved: ResolvedExpectation[] = []
  for (const e of c.expected) {
    const r = resolveExpectation(c.text, e)
    if (r) resolved.push(r)
    else unresolved.push({ category: e.category, value: e.value, start: -1, end: -1 })
  }

  const base = { id: c.id, split: c.split, tags: c.tags, expectedDecision: c.expectedDecision }
  const startedAt = clock()
  let scan: ScanResult | null = null
  try {
    scan = deps.scan(c.text)
  } catch {
    scan = null
  }
  const durationMs = Math.max(0, clock() - startedAt)

  if (scan === null) {
    const missed = [...resolved, ...unresolved]
    missed.forEach((m) => bump(perCategory, m.category, 'fn'))
    return {
      perCategory,
      outcome: {
        ...base,
        actualDecision: null,
        decisionCorrect: false,
        tp: 0,
        fp: 0,
        fn: missed.length,
        spanExact: 0,
        redactionOk: c.expected.length > 0 ? false : null,
        durationMs,
        scanStatus: 'failed',
        missed: missed.map((m) => ({ category: m.category, value: maskValue(m.value) })),
        unexpected: [],
      },
    }
  }

  const predictions = scan.findings.filter((f) => f.category !== 'obfuscation')
  const match = matchSpans(resolved, predictions)
  const missed = [...match.missed, ...unresolved]
  const matchedCategories = resolved.filter((r) => !match.missed.includes(r))
  matchedCategories.forEach((m) => bump(perCategory, m.category, 'tp'))
  missed.forEach((m) => bump(perCategory, m.category, 'fn'))
  const acceptable = (c.acceptable ?? []).flatMap((e) => resolveExpectation(c.text, e) ?? [])
  const isAcceptable = (p: Finding) =>
    acceptable.some((a) => a.category === p.category && p.startOffset < a.end && a.start < p.endOffset)
  const falsePositives = match.unmatchedPredictions.filter((p) => !isAcceptable(p))
  falsePositives.forEach((p) => bump(perCategory, p.category, 'fp'))

  return {
    perCategory,
    outcome: {
      ...base,
      actualDecision: scan.policyDecision,
      decisionCorrect: scan.policyDecision === c.expectedDecision,
      tp: match.tp,
      fp: falsePositives.length,
      fn: missed.length,
      spanExact: match.exact,
      redactionOk: c.expected.length > 0 ? checkRedaction(c, scan, deps) : null,
      durationMs,
      scanStatus: scan.status,
      missed: missed.map((m) => ({ category: m.category, value: maskValue(m.value) })),
      unexpected: falsePositives.map((p) => ({ category: p.category, detectorId: p.detectorId })),
    },
  }
}

function sum(outcomes: CaseOutcome[], key: 'tp' | 'fp' | 'fn' | 'spanExact'): number {
  return outcomes.reduce((acc, o) => acc + o[key], 0)
}

function splitMetrics(outcomes: CaseOutcome[]): SplitMetrics {
  const tp = sum(outcomes, 'tp')
  return {
    cases: outcomes.length,
    precision: precisionOf(tp, sum(outcomes, 'fp')),
    recall: recallOf(tp, sum(outcomes, 'fn')),
    policyAccuracy: ratio(outcomes.filter((o) => o.decisionCorrect).length, outcomes.length),
  }
}

function categoryMetrics(counts: CatCounts): EvalReport['perCategory'] {
  const result: EvalReport['perCategory'] = {}
  for (const category of Object.keys(counts).sort()) {
    const { tp, fp, fn } = counts[category]
    const precision = precisionOf(tp, fp)
    const recall = recallOf(tp, fn)
    result[category as Category] = { tp, fp, fn, precision, recall, f1: f1Of(precision, recall), support: tp + fn }
  }
  return result
}

export function runEvaluation(cases: readonly EvalCase[], deps: EvalDeps): EvalReport {
  const clock = deps.clock ?? defaultClock
  const runs = cases.map((c) => runCase(c, deps, clock))
  const outcomes = runs.map((r) => r.outcome)

  const merged: CatCounts = {}
  for (const run of runs) {
    for (const [cat, n] of Object.entries(run.perCategory)) {
      bump(merged, cat as Category, 'tp', n.tp)
      bump(merged, cat as Category, 'fp', n.fp)
      bump(merged, cat as Category, 'fn', n.fn)
    }
  }

  const tp = sum(outcomes, 'tp')
  const fp = sum(outcomes, 'fp')
  const fn = sum(outcomes, 'fn')
  const precision = precisionOf(tp, fp)
  const recall = recallOf(tp, fn)
  const redactionRuns = outcomes.filter((o) => o.redactionOk !== null)
  const negatives = outcomes.filter((o) => o.tags.includes('negative'))
  const durations = outcomes.map((o) => o.durationMs)
  const intrusive = ['redact', 'review', 'block']

  return {
    corpusVersion: CORPUS_VERSION,
    generatedAt: new Date((deps.now ?? Date.now)()).toISOString(),
    totals: { cases: outcomes.length, tp, fp, fn, precision, recall, f1: f1Of(precision, recall) },
    perCategory: categoryMetrics(merged),
    spanAccuracy: ratio(sum(outcomes, 'spanExact'), tp),
    policyAccuracy: ratio(outcomes.filter((o) => o.decisionCorrect).length, outcomes.length),
    redactionSuccess: ratio(redactionRuns.filter((o) => o.redactionOk === true).length, redactionRuns.length),
    falseBlockRate: ratio(
      negatives.filter((o) => o.actualDecision === null || intrusive.includes(o.actualDecision)).length,
      negatives.length,
    ),
    latency: { p50: percentile(durations, 50), p95: percentile(durations, 95), max: durations.length ? Math.max(...durations) : null },
    bySplit: {
      dev: splitMetrics(outcomes.filter((o) => o.split === 'dev')),
      heldout: splitMetrics(outcomes.filter((o) => o.split === 'heldout')),
    },
    cases: outcomes,
  }
}
