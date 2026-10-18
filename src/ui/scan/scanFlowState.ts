import type { Policy, SanitizeResult, ScanResult } from '../../core'
import { decisionMap, defaultSelection, toggleSelection } from './selection'

/** The completed scan the Review step is built on, with the exact text and policy it ran under. */
export interface ScanSnapshot {
  text: string
  policy: Policy
  result: ScanResult
}

/** A completed redaction. `scan` is the scan the findings came from (after any retention re-scan). */
export interface SanitizedOutput {
  source: string
  scan: ScanResult
  result: SanitizeResult
  /** How many findings the user unticked and kept (retained). */
  kept: number
}

export interface ReviewState {
  snapshot: ScanSnapshot
  selected: ReadonlySet<string>
  /** A redaction is running. */
  busy: boolean
  /** Honest message from a redaction that did not complete. Cleared by the next action. */
  error: string | null
}

/** Scan flow: Write, then Review, then Sanitized. The Sanitized step keeps the Review selection for "Back". */
export type FlowState =
  | { step: 'write' }
  | { step: 'review'; review: ReviewState }
  | { step: 'sanitized'; review: ReviewState; output: SanitizedOutput }

export type FlowAction =
  | { type: 'scanned'; snapshot: ScanSnapshot }
  | { type: 'toggle'; findingId: string }
  | { type: 'redact-start' }
  | { type: 'redact-failed'; message: string }
  | { type: 'sanitized'; output: SanitizedOutput }
  | { type: 'back' }
  | { type: 'edit' }
  | { type: 'policy-changed'; policy: Policy }

export const INITIAL_FLOW: FlowState = { step: 'write' }

function reviewFor(snapshot: ScanSnapshot): ReviewState {
  const decisions = decisionMap(snapshot.result.findingDecisions)
  return {
    snapshot,
    selected: defaultSelection(snapshot.result.findings, decisions),
    busy: false,
    error: null,
  }
}

/**
 * Pure transitions for the Scan flow. Anything that leaves Review or Sanitized drops the output, which
 * is where the placeholder mapping lives, so the mapping never outlives the output it belongs to.
 */
export function scanFlowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'scanned':
      return { step: 'review', review: reviewFor(action.snapshot) }

    case 'edit':
      return INITIAL_FLOW

    case 'policy-changed':
      // A different policy makes the scan out of date, so the flow goes back to Write with the text intact.
      return state.step !== 'write' && state.review.snapshot.policy !== action.policy ? INITIAL_FLOW : state

    case 'toggle': {
      if (state.step !== 'review' || state.review.busy) return state
      const decisions = decisionMap(state.review.snapshot.result.findingDecisions)
      const selected = toggleSelection(state.review.selected, decisions, action.findingId)
      if (selected === state.review.selected) return state
      return { step: 'review', review: { ...state.review, selected, error: null } }
    }

    case 'redact-start':
      if (state.step !== 'review') return state
      return { step: 'review', review: { ...state.review, busy: true, error: null } }

    case 'redact-failed':
      if (state.step !== 'review') return state
      return { step: 'review', review: { ...state.review, busy: false, error: action.message } }

    case 'sanitized':
      if (state.step !== 'review') return state
      return { step: 'sanitized', review: { ...state.review, busy: false, error: null }, output: action.output }

    case 'back':
      if (state.step !== 'sanitized') return state
      return { step: 'review', review: { ...state.review, busy: false, error: null } }

    default:
      return state
  }
}
