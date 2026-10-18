import type { Category, Finding } from '../types'
import type { EvalExpectation } from './corpus/helpers'

export interface ResolvedExpectation {
  category: Category
  value: string
  start: number
  end: number
}

export interface MatchResult {
  /** Number of matched (expected, predicted) pairs. */
  tp: number
  /** Matched pairs whose start/end are identical. */
  exact: number
  /** Expectations that were not matched (includes unresolvable ones). */
  missed: ResolvedExpectation[]
  /** Predictions that were not matched. */
  unmatchedPredictions: Finding[]
}

/** Locates the nth occurrence (1-based) of expectation.value; null when absent. */
export function resolveExpectation(text: string, exp: EvalExpectation): ResolvedExpectation | null {
  const occurrence = exp.occurrence ?? 1
  let from = 0
  let idx = -1
  for (let i = 0; i < occurrence; i++) {
    idx = text.indexOf(exp.value, from)
    if (idx < 0) return null
    from = idx + Math.max(1, exp.value.length)
  }
  return { category: exp.category, value: exp.value, start: idx, end: idx + exp.value.length }
}

function overlapSize(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
}

/**
 * Greedy one-to-one matching: exact span matches first, then the largest overlap.
 * A prediction matches an expectation when categories are equal and the spans overlap.
 */
export function matchSpans(expected: ResolvedExpectation[], predictions: Finding[]): MatchResult {
  const usedExp = new Set<number>()
  const usedPred = new Set<number>()
  let exact = 0

  expected.forEach((e, ei) => {
    const pi = predictions.findIndex(
      (p, i) => !usedPred.has(i) && p.category === e.category && p.startOffset === e.start && p.endOffset === e.end,
    )
    if (pi >= 0) {
      usedExp.add(ei)
      usedPred.add(pi)
      exact++
    }
  })

  expected.forEach((e, ei) => {
    if (usedExp.has(ei)) return
    let best = -1
    let bestOverlap = 0
    predictions.forEach((p, i) => {
      if (usedPred.has(i) || p.category !== e.category) return
      const size = overlapSize(e.start, e.end, p.startOffset, p.endOffset)
      if (size > bestOverlap) {
        best = i
        bestOverlap = size
      }
    })
    if (best >= 0) {
      usedExp.add(ei)
      usedPred.add(best)
    }
  })

  return {
    tp: usedExp.size,
    exact,
    missed: expected.filter((_, i) => !usedExp.has(i)),
    unmatchedPredictions: predictions.filter((_, i) => !usedPred.has(i)),
  }
}
