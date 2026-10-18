import type { SanitizeResult, ScanResult } from '../../core'
import type { ShellTint } from '../state/contexts'
import type { FlowState } from './scanFlowState'
import { sanitizedVerdict } from './readiness'

/** Review is ember when the risk is high or critical, or the policy blocks or reviews the prompt. */
export function reviewTint(scan: Pick<ScanResult, 'riskBand' | 'policyDecision'>): ShellTint {
  const highRisk = scan.riskBand === 'high' || scan.riskBand === 'critical'
  const gated = scan.policyDecision === 'block' || scan.policyDecision === 'review'
  return highRisk || gated ? 'ember' : 'neutral'
}

/** Sage exactly when the headline is "Ready to send."; ember for the honest not-ready headline. Same verdict as the headline. */
export function sanitizedTint(result: SanitizeResult, kept: number): ShellTint {
  return sanitizedVerdict(result, kept).tint
}

/** The background tint for the whole flow. Write is always neutral. */
export function flowTint(flow: FlowState): ShellTint {
  switch (flow.step) {
    case 'write':
      return 'neutral'
    case 'review':
      return reviewTint(flow.review.snapshot.result)
    case 'sanitized':
      return sanitizedTint(flow.output.result, flow.output.kept)
  }
}
