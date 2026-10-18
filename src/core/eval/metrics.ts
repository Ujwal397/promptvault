/** Pure metric helpers for the evaluation harness. */

export function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator
}

export function precisionOf(tp: number, fp: number): number | null {
  return ratio(tp, tp + fp)
}

export function recallOf(tp: number, fn: number): number | null {
  return ratio(tp, tp + fn)
}

export function f1Of(precision: number | null, recall: number | null): number | null {
  if (precision === null || recall === null) return null
  const sum = precision + recall
  return sum === 0 ? 0 : (2 * precision * recall) / sum
}

/** Nearest-rank percentile (p in 0..100). Null for an empty sample. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length))
  return sorted[Math.min(rank, sorted.length) - 1]
}

/** Keeps a short prefix (at most 2 chars, at most half the value) so reports never expose full secrets. */
export function maskValue(value: string): string {
  const keep = Math.min(2, Math.floor(value.length / 2))
  return value.slice(0, keep) + '…'
}
