import { describe, expect, it } from 'vitest'
import { PERMISSIVE_POLICY, STRICT_POLICY } from '../../core'
import { scanFlowReducer, INITIAL_FLOW, type FlowState, type SanitizedOutput, type ScanSnapshot } from './scanFlowState'
import { makeDecision, makeFinding, makeSanitize, makeScan } from './scanFixtures'

const findings = [
  makeFinding({ findingId: 'f-0', startOffset: 0, endOffset: 5 }),
  makeFinding({ findingId: 'f-1', startOffset: 10, endOffset: 20, category: 'credential', label: 'API key' }),
]
const snapshot: ScanSnapshot = {
  text: 'a@b.io and secret',
  policy: STRICT_POLICY,
  result: makeScan({
    findings,
    findingDecisions: [makeDecision('f-0', 'redact'), makeDecision('f-1', 'redact', { mandatory: true })],
    riskBand: 'high',
    riskScore: 82,
    policyDecision: 'redact',
  }),
}
const output: SanitizedOutput = { source: snapshot.text, scan: snapshot.result, result: makeSanitize(), kept: 0 }

function review(state: FlowState) {
  if (state.step === 'write') throw new Error('expected review')
  return state.review
}

describe('scanFlowReducer', () => {
  it('moves to Review with the default selection', () => {
    const state = scanFlowReducer(INITIAL_FLOW, { type: 'scanned', snapshot })
    expect(state.step).toBe('review')
    expect([...review(state).selected].sort()).toEqual(['f-0', 'f-1'])
    expect(review(state).busy).toBe(false)
  })

  it('unticks an optional finding and ignores toggles on locked ones', () => {
    let state = scanFlowReducer(INITIAL_FLOW, { type: 'scanned', snapshot })
    state = scanFlowReducer(state, { type: 'toggle', findingId: 'f-0' })
    expect([...review(state).selected]).toEqual(['f-1'])
    const same = scanFlowReducer(state, { type: 'toggle', findingId: 'f-1' })
    expect(same).toBe(state)
  })

  it('drops an error when the selection changes', () => {
    let state = scanFlowReducer(INITIAL_FLOW, { type: 'scanned', snapshot })
    state = scanFlowReducer(state, { type: 'redact-failed', message: 'nope' })
    state = scanFlowReducer(state, { type: 'toggle', findingId: 'f-0' })
    expect(review(state).error).toBeNull()
  })

  it('tracks a redaction in progress, then a failure that stays on Review', () => {
    let state = scanFlowReducer(INITIAL_FLOW, { type: 'scanned', snapshot })
    state = scanFlowReducer(state, { type: 'redact-start' })
    expect(review(state).busy).toBe(true)
    state = scanFlowReducer(state, { type: 'redact-failed', message: 'Redaction did not finish.' })
    expect(state.step).toBe('review')
    expect(review(state)).toMatchObject({ busy: false, error: 'Redaction did not finish.' })
  })

  it('does not let toggles change the selection while a redaction runs', () => {
    let state = scanFlowReducer(INITIAL_FLOW, { type: 'scanned', snapshot })
    state = scanFlowReducer(state, { type: 'redact-start' })
    expect(scanFlowReducer(state, { type: 'toggle', findingId: 'f-0' })).toBe(state)
  })

  it('moves to Sanitized, and Back returns to Review with the same selection', () => {
    let state = scanFlowReducer(INITIAL_FLOW, { type: 'scanned', snapshot })
    state = scanFlowReducer(state, { type: 'toggle', findingId: 'f-0' })
    const selectedBefore = review(state).selected
    state = scanFlowReducer(state, { type: 'sanitized', output })
    expect(state.step).toBe('sanitized')
    state = scanFlowReducer(state, { type: 'back' })
    expect(state.step).toBe('review')
    expect(review(state).selected).toBe(selectedBefore)
  })

  it('drops the sanitized output (and its mapping) when going Back', () => {
    const withMapping: SanitizedOutput = {
      ...output,
      result: { ...output.result, mapping: { '[EMAIL_1]': 'mapped-only-value' } },
    }
    let state = scanFlowReducer(INITIAL_FLOW, { type: 'scanned', snapshot })
    state = scanFlowReducer(state, { type: 'sanitized', output: withMapping })
    expect(JSON.stringify(state)).toContain('mapped-only-value')
    state = scanFlowReducer(state, { type: 'back' })
    expect(state.step).toBe('review')
    expect(JSON.stringify(state)).not.toContain('mapped-only-value')
  })

  it('returns to Write from anywhere on Edit prompt', () => {
    let state = scanFlowReducer(INITIAL_FLOW, { type: 'scanned', snapshot })
    state = scanFlowReducer(state, { type: 'sanitized', output })
    expect(scanFlowReducer(state, { type: 'edit' })).toEqual(INITIAL_FLOW)
  })

  it('ignores redaction actions when not on Review', () => {
    expect(scanFlowReducer(INITIAL_FLOW, { type: 'redact-start' })).toBe(INITIAL_FLOW)
    expect(scanFlowReducer(INITIAL_FLOW, { type: 'sanitized', output })).toBe(INITIAL_FLOW)
    expect(scanFlowReducer(INITIAL_FLOW, { type: 'back' })).toBe(INITIAL_FLOW)
  })

  it('goes back to Write when the policy changes under an open review', () => {
    const state = scanFlowReducer(INITIAL_FLOW, { type: 'scanned', snapshot })
    expect(scanFlowReducer(state, { type: 'policy-changed', policy: PERMISSIVE_POLICY })).toEqual(INITIAL_FLOW)
  })

  it('keeps the review when the policy object is unchanged', () => {
    const state = scanFlowReducer(INITIAL_FLOW, { type: 'scanned', snapshot })
    expect(scanFlowReducer(state, { type: 'policy-changed', policy: STRICT_POLICY })).toBe(state)
  })
})
