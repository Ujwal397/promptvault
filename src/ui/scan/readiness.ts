import type { SanitizeResult } from '../../core'

export const READY_HEADLINE = 'Ready to send.'
export const NOT_READY_HEADLINE = 'Not ready to send.'

/** Ready only when the output was re-scanned to completion and nothing still needs action. */
export function isFullyValidated(result: SanitizeResult): boolean {
  return (
    result.status === 'completed' &&
    result.validationPassed &&
    result.residualFindingIds.length === 0 &&
    result.postScan?.status === 'completed'
  )
}

export type Readiness = { ready: true; kept: number } | { ready: false; kept: number; reason: string }

function notReadyReason(result: SanitizeResult): string {
  if (result.status !== 'completed') return 'Redaction did not complete, so this output is not validated.'
  if (result.postScan?.status !== 'completed') return 'The re-scan did not finish, so this output is not validated.'
  const residual = result.residualFindingIds.length
  if (residual > 0) {
    return residual === 1 ? '1 item still needs action under this policy.' : `${residual} items still need action under this policy.`
  }
  return 'The re-scan did not validate this output. See the notes below.'
}

/**
 * Copy state for the Sanitized step. `kept` counts findings the user chose to keep. They are not residual
 * for the core (the re-scan allows them), so the output still validates. The status line reports them.
 */
export function sanitizeReadiness(result: SanitizeResult, kept: number): Readiness {
  if (isFullyValidated(result)) return { ready: true, kept }
  return { ready: false, kept, reason: notReadyReason(result) }
}

/**
 * The one verdict behind the Sanitized step's headline and background tint, so the two cannot disagree:
 * sage exactly when the headline is "Ready to send.", and ember only for the honest not-ready headline.
 * Items the user kept do not change this (the output still validates); the status line says they were kept.
 */
export interface SanitizedVerdict {
  readiness: Readiness
  headline: string
  tint: 'sage' | 'ember'
}

export function sanitizedVerdict(result: SanitizeResult, kept: number): SanitizedVerdict {
  const readiness = sanitizeReadiness(result, kept)
  return readiness.ready
    ? { readiness, headline: READY_HEADLINE, tint: 'sage' }
    : { readiness, headline: NOT_READY_HEADLINE, tint: 'ember' }
}
