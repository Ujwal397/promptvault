import type { EngineError, ScanResult } from '../../core'

/** Synthetic sample for the failure drill. Nothing is detected in it because every detector is forced to fail. */
export const DRILL_SAMPLE = 'Synthetic drill sample: send the quarterly summary to drill.user@example.com.'

export interface DrillVerdict {
  /** True only when the scan did not complete AND the decision is block. */
  held: boolean
  headline: string
  detail: string
}

export interface ErrorCount {
  code: string
  count: number
}

/** Counts each error code once, in code order, so 81 identical detector failures read as one line. */
export function countErrorCodes(errors: readonly EngineError[]): ErrorCount[] {
  const counts = new Map<string, number>()
  for (const error of errors) counts.set(error.code, (counts.get(error.code) ?? 0) + 1)
  return [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([code, count]) => ({ code, count }))
}

/**
 * Fail-closed check on the real drill result. A scan that did not complete must never read as clean,
 * so the drill only holds when it is incomplete and its decision is block.
 */
export function interpretDrill(result: Pick<ScanResult, 'status' | 'policyDecision'>): DrillVerdict {
  if (result.status === 'completed') {
    return {
      held: false,
      headline: 'Fail-closed did not hold.',
      detail: 'The scan reported completed even though the detectors were made to fail. The injected fault was not seen.',
    }
  }
  if (result.policyDecision !== 'block') {
    return {
      held: false,
      headline: `Fail-closed did not hold. The decision is ${result.policyDecision}, not block.`,
      detail: 'A scan that did not complete must block the prompt.',
    }
  }
  return {
    held: true,
    headline: 'Fail-closed held.',
    detail: `The scan ${result.status === 'failed' ? 'failed' : 'was incomplete'}, the decision is block, and the prompt is not treated as clean.`,
  }
}
