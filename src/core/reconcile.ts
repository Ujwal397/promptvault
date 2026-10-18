import { SEVERITY_SCORE, type Finding, type RawFinding } from './types'

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Deterministic (built-in, possibly mandatory) findings must never be shadowed by user rules or advisory analyzers. */
const SOURCE_RANK: Record<RawFinding['source'], number> = { deterministic: 0, custom: 1, contextual: 2 }

/** Higher priority sorts first. */
function byPriority(a: RawFinding, b: RawFinding): number {
  return (
    SOURCE_RANK[a.source] - SOURCE_RANK[b.source] ||
    SEVERITY_SCORE[b.severity] - SEVERITY_SCORE[a.severity] ||
    b.confidence - a.confidence ||
    b.endOffset - b.startOffset - (a.endOffset - a.startOffset) ||
    cmp(a.detectorId, b.detectorId) ||
    a.startOffset - b.startOffset ||
    a.endOffset - b.endOffset ||
    cmp(a.category, b.category)
  )
}

function byPosition(a: RawFinding, b: RawFinding): number {
  return a.startOffset - b.startOffset || a.endOffset - b.endOffset || cmp(a.detectorId, b.detectorId)
}

function overlaps(a: RawFinding, b: RawFinding): boolean {
  return a.startOffset < b.endOffset && b.startOffset < a.endOffset
}

/**
 * Deterministic overlap resolution. Obfuscation findings never suppress and are never
 * suppressed (only exact duplicates from the same detector are collapsed).
 */
export function reconcile(raw: RawFinding[], maxFindings: number): Finding[] {
  const cap = Math.max(0, Math.floor(maxFindings))
  const solid = raw.filter((f) => f.category !== 'obfuscation').sort(byPriority)
  const advisory = raw.filter((f) => f.category === 'obfuscation').sort(byPriority)

  const accepted: RawFinding[] = []
  const merged = new Map<RawFinding, Set<string>>()

  for (const f of solid) {
    const winner = accepted.find((a) => overlaps(a, f))
    if (winner) {
      if (f.detectorId !== winner.detectorId) merged.get(winner)?.add(f.detectorId)
      for (const id of f.mergedDetectorIds ?? []) {
        if (id !== winner.detectorId) merged.get(winner)?.add(id)
      }
      continue
    }
    if (accepted.length >= cap) continue
    accepted.push(f)
    merged.set(f, new Set(f.mergedDetectorIds ?? []))
  }

  const seen = new Set<string>()
  const kept: RawFinding[] = [...accepted]
  for (const f of advisory) {
    const key = `${f.detectorId}:${f.startOffset}:${f.endOffset}`
    if (seen.has(key) || kept.length >= cap) continue
    seen.add(key)
    kept.push(f)
    merged.set(f, new Set(f.mergedDetectorIds ?? []))
  }

  return kept.sort(byPosition).map((f, i) => {
    const ids = [...(merged.get(f) ?? [])].sort(cmp)
    const { mergedDetectorIds: _drop, ...rest } = f
    void _drop
    return { ...rest, findingId: `f-${i}`, ...(ids.length > 0 ? { mergedDetectorIds: ids } : {}) }
  })
}
