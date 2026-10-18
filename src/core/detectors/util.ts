import type { Category, RawFinding, RecommendedAction, Severity, Span } from '../types'

/** Safe global-regex iterator. Requires the `g` flag; always advances on empty matches. */
export function* matchAll(regex: RegExp, text: string): Generator<RegExpExecArray> {
  if (!regex.global) throw new Error('matchAll requires a regex with the g flag')
  const re = new RegExp(regex.source, regex.flags)
  re.lastIndex = 0
  for (;;) {
    const m = re.exec(text)
    if (!m) return
    if (m[0].length === 0) re.lastIndex++
    yield m
  }
}

/** Shannon entropy in bits per character. */
export function shannonEntropy(s: string): number {
  if (s.length === 0) return 0
  const counts = new Map<string, number>()
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  const n = [...s].length
  let h = 0
  for (const c of counts.values()) {
    const p = c / n
    h -= p * Math.log2(p)
  }
  return h
}

/** Luhn check over a string of digits only. */
export function luhnValid(digits: string): boolean {
  if (!/^\d{2,}$/.test(digits)) return false
  let sum = 0
  let dbl = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (dbl) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    dbl = !dbl
  }
  return sum % 10 === 0
}

export interface FindingSpec {
  detectorId: string
  detectorVersion: string
  category: Category
  start: number
  end: number
  severity: Severity
  confidence: number
  reasonCode: string
  label: string
  explanation: string
  placeholderType: string
  recommendedAction?: RecommendedAction
  source?: RawFinding['source']
  sensitiveSubspans?: Span[]
}

/** Builds a RawFinding. Confidence is clamped to [0,1]. Explanation must not contain the value. */
export function makeFinding(spec: FindingSpec): RawFinding {
  const f: RawFinding = {
    category: spec.category,
    startOffset: spec.start,
    endOffset: spec.end,
    severity: spec.severity,
    confidence: Math.min(1, Math.max(0, spec.confidence)),
    detectorId: spec.detectorId,
    detectorVersion: spec.detectorVersion,
    reasonCode: spec.reasonCode,
    recommendedAction: spec.recommendedAction ?? 'redact',
    label: spec.label,
    explanation: spec.explanation,
    placeholderType: spec.placeholderType,
    source: spec.source ?? 'deterministic',
  }
  return spec.sensitiveSubspans ? { ...f, sensitiveSubspans: spec.sensitiveSubspans } : f
}

/**
 * True if any label appears (case-insensitive) in the `window` chars before `index`.
 * A label only counts when it is not preceded by a letter (so "tel" does not match "hotel").
 */
export function hasLabelBefore(text: string, index: number, labels: readonly string[], window = 40): boolean {
  const seg = text.slice(Math.max(0, index - window), index).toLowerCase()
  for (const label of labels) {
    const needle = label.toLowerCase()
    let from = 0
    for (;;) {
      const at = seg.indexOf(needle, from)
      if (at < 0) break
      if (at === 0 || !/\p{L}/u.test(seg[at - 1])) return true
      from = at + 1
    }
  }
  return false
}

/** Digits only. */
export function digitsOf(s: string): string {
  return s.replace(/\D/g, '')
}
