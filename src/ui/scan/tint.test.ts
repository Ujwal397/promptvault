import { describe, expect, it } from 'vitest'
import { STRICT_POLICY } from '../../core'
import type { FlowState } from './scanFlowState'
import { makeScan, makeSanitize } from './scanFixtures'
import { flowTint, reviewTint, sanitizedTint } from './tint'

describe('reviewTint', () => {
  it('is ember for high and critical risk', () => {
    expect(reviewTint({ riskBand: 'high', policyDecision: 'redact' })).toBe('ember')
    expect(reviewTint({ riskBand: 'critical', policyDecision: 'redact' })).toBe('ember')
  })

  it('is ember when the policy blocks or reviews, whatever the band', () => {
    expect(reviewTint({ riskBand: 'low', policyDecision: 'block' })).toBe('ember')
    expect(reviewTint({ riskBand: 'medium', policyDecision: 'review' })).toBe('ember')
  })

  it('is neutral for low or medium risk that the policy only warns or redacts', () => {
    expect(reviewTint({ riskBand: 'medium', policyDecision: 'redact' })).toBe('neutral')
    expect(reviewTint({ riskBand: 'low', policyDecision: 'warn' })).toBe('neutral')
    expect(reviewTint({ riskBand: 'none', policyDecision: 'allow' })).toBe('neutral')
  })
})

describe('sanitizedTint', () => {
  it('is sage for a fully validated output with nothing kept', () => {
    expect(sanitizedTint(makeSanitize(), 0)).toBe('sage')
  })

  it('is sage when the user kept items, because the headline is still "Ready to send."', () => {
    expect(sanitizedTint(makeSanitize(), 1)).toBe('sage')
    expect(sanitizedTint(makeSanitize(), 3)).toBe('sage')
  })

  it('is ember when residual findings remain or validation failed', () => {
    expect(sanitizedTint(makeSanitize({ residualFindingIds: ['f-0'], validationPassed: false }), 0)).toBe('ember')
    expect(sanitizedTint(makeSanitize({ validationPassed: false }), 0)).toBe('ember')
  })

  it('is ember when the re-scan did not finish, even with kept items', () => {
    expect(sanitizedTint(makeSanitize({ postScan: makeScan({ status: 'partial' }), validationPassed: false }), 2)).toBe('ember')
  })
})

describe('flowTint', () => {
  it('is neutral on Write', () => {
    expect(flowTint({ step: 'write' })).toBe('neutral')
  })

  it('derives Review and Sanitized tints from the results, not from the step', () => {
    const review = {
      snapshot: { text: '', policy: STRICT_POLICY, result: makeScan({ riskBand: 'high', policyDecision: 'redact' }) },
      selected: new Set<string>(),
      busy: false,
      error: null,
    }
    const reviewFlow: FlowState = { step: 'review', review }
    expect(flowTint(reviewFlow)).toBe('ember')

    const sanitizedFlow: FlowState = {
      step: 'sanitized',
      review,
      output: { source: '', scan: review.snapshot.result, result: makeSanitize(), kept: 0 },
    }
    expect(flowTint(sanitizedFlow)).toBe('sage')
  })
})
