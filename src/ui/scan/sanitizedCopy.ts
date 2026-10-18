import type { SanitizeResult } from '../../core'
import { maskSpan } from './masking'
import type { Readiness } from './readiness'

export type CopyState = 'idle' | 'copied' | 'failed'

export interface StatusCopy {
  tone: 'ok' | 'kept' | 'bad'
  /** Bold first part of the status line. */
  lead: string
  /** The rest of the status line. */
  rest: string
}

export interface ResidualRow {
  key: string
  label: string
  /** Masked preview of the still-present text. */
  masked: string
}

/** Number of distinct findings that were replaced (one finding can produce several replacements). */
export function replacedCount(result: SanitizeResult): number {
  return new Set(result.replacements.map((r) => r.findingId)).size
}

export function replacedPhrase(count: number): string {
  if (count === 0) return 'Nothing was replaced'
  return count === 1 ? '1 item replaced' : `${count} items replaced`
}

function keptPhrase(kept: number): string {
  return kept === 1 ? '1 item kept as you chose' : `${kept} items kept as you chose`
}

/**
 * The status line under the headline. "No risk left" appears only when the output is fully validated
 * and nothing was kept. Otherwise the line states what is still wrong.
 */
export function statusCopy(result: SanitizeResult, readiness: Readiness): StatusCopy {
  const replaced = replacedPhrase(replacedCount(result))
  if (!readiness.ready) {
    const residual = result.residualFindingIds.length
    return { tone: 'bad', lead: residual > 0 ? 'Residual risk' : 'Not validated', rest: readiness.reason }
  }
  if (readiness.kept > 0) {
    return { tone: 'kept', lead: keptPhrase(readiness.kept), rest: `${replaced} · re-scan found nothing else to act on` }
  }
  return { tone: 'ok', lead: 'No risk left', rest: `${replaced} · re-scan found nothing left` }
}

/** Text shown under the output: why Copy is off, or what happened on the last copy attempt. */
export function copyMessage(state: CopyState, readiness: Readiness): string {
  if (state === 'copied') return 'Copied to the clipboard. The copy has the real placeholders, such as [EMAIL_1].'
  if (state === 'failed') return 'Your browser blocked copying, so nothing was copied. Allow clipboard access for this page and try again.'
  return readiness.ready ? '' : `Copy is off. ${readiness.reason}`
}

/** Residual findings from the re-scan, labelled and masked. Looked up in postScan, whose offsets are into the sanitized text. */
export function residualRows(result: SanitizeResult): ResidualRow[] {
  const ids = new Set(result.residualFindingIds)
  const text = result.sanitizedText ?? ''
  return (result.postScan?.findings ?? [])
    .filter((f) => ids.has(f.findingId))
    .map((f) => ({ key: f.findingId, label: f.label || f.category, masked: maskSpan(text, f) }))
}
