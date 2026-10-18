import type { Severity } from '../../core'

export interface HighlightRange {
  /** UTF-16 offsets into the text, half-open [start, end). */
  start: number
  end: number
  id: string
  severity: Severity
  selected: boolean
}

export interface TextSegment {
  text: string
  /** Ids of every range that covers this segment. Empty for plain text. */
  ids: string[]
  /** Strongest severity among the covering ranges, or null for plain text. */
  severity: Severity | null
  /** True when at least one covering range is selected. */
  selected: boolean
}

const RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 }

function isValidRange(range: HighlightRange, length: number): boolean {
  return (
    Number.isInteger(range.start) &&
    Number.isInteger(range.end) &&
    range.start >= 0 &&
    range.end <= length &&
    range.start < range.end
  )
}

function addTo(map: Map<number, HighlightRange[]>, at: number, range: HighlightRange): void {
  const list = map.get(at)
  if (list) list.push(range)
  else map.set(at, [range])
}

function describe(text: string, covering: readonly HighlightRange[]): TextSegment {
  const severity = covering.reduce<Severity | null>(
    (best, r) => (best === null || RANK[r.severity] > RANK[best] ? r.severity : best),
    null,
  )
  return {
    text,
    ids: covering.map((r) => r.id),
    severity,
    selected: covering.some((r) => r.selected),
  }
}

function sameStyle(a: TextSegment, b: TextSegment): boolean {
  return a.severity === b.severity && a.selected === b.selected && a.ids.join('\u0000') === b.ids.join('\u0000')
}

/** Joins neighbouring segments that share the same covering ranges, so the output has fewer nodes. */
function mergeNeighbours(segments: readonly TextSegment[]): TextSegment[] {
  const out: TextSegment[] = []
  for (const segment of segments) {
    const last = out[out.length - 1]
    if (last && sameStyle(last, segment)) out[out.length - 1] = { ...last, text: last.text + segment.text }
    else out.push(segment)
  }
  return out
}

/**
 * Splits text at every range boundary, so overlapping and nested ranges each get exact segments and
 * the segments always concatenate back to the original text. Invalid ranges (out of bounds, empty or
 * inverted) are ignored rather than drawn.
 */
export function segmentText(text: string, ranges: readonly HighlightRange[]): TextSegment[] {
  const valid = ranges.filter((r) => isValidRange(r, text.length))
  const starts = new Map<number, HighlightRange[]>()
  const ends = new Map<number, HighlightRange[]>()
  const cuts = new Set<number>([0, text.length])
  for (const range of valid) {
    addTo(starts, range.start, range)
    addTo(ends, range.end, range)
    cuts.add(range.start)
    cuts.add(range.end)
  }

  const points = [...cuts].sort((a, b) => a - b)
  const active = new Set<HighlightRange>()
  const segments: TextSegment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const at = points[i] as number
    const next = points[i + 1] as number
    for (const range of ends.get(at) ?? []) active.delete(range)
    for (const range of starts.get(at) ?? []) active.add(range)
    segments.push(describe(text.slice(at, next), [...active]))
  }
  return mergeNeighbours(segments)
}
