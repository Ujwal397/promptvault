import { describe, expect, it } from 'vitest'
import { makeScan, makeSanitize } from './scanFixtures'
import { isFullyValidated, NOT_READY_HEADLINE, READY_HEADLINE, sanitizeReadiness, sanitizedVerdict } from './readiness'
import { sanitizedTint } from './tint'

describe('isFullyValidated', () => {
  it('is true only for a completed, validated output with no residual findings', () => {
    expect(isFullyValidated(makeSanitize())).toBe(true)
  })

  it('is false when validation did not pass', () => {
    expect(isFullyValidated(makeSanitize({ validationPassed: false }))).toBe(false)
  })

  it('is false when anything is still residual', () => {
    expect(isFullyValidated(makeSanitize({ residualFindingIds: ['f-0'] }))).toBe(false)
  })

  it('is false when the re-scan was not completed', () => {
    expect(isFullyValidated(makeSanitize({ postScan: makeScan({ status: 'partial' }) }))).toBe(false)
    expect(isFullyValidated(makeSanitize({ postScan: null }))).toBe(false)
  })

  it('is false when the redaction itself did not complete', () => {
    expect(isFullyValidated(makeSanitize({ status: 'rejected', sanitizedText: null }))).toBe(false)
  })
})

describe('sanitizeReadiness', () => {
  it('is ready when fully validated and nothing was kept', () => {
    expect(sanitizeReadiness(makeSanitize(), 0)).toEqual({ ready: true, kept: 0 })
  })

  it('is still ready when the user kept items, and reports how many', () => {
    expect(sanitizeReadiness(makeSanitize(), 2)).toEqual({ ready: true, kept: 2 })
  })

  it('reports residual findings with a singular and a plural message', () => {
    const one = sanitizeReadiness(makeSanitize({ residualFindingIds: ['f-0'], validationPassed: false }), 0)
    const many = sanitizeReadiness(makeSanitize({ residualFindingIds: ['f-0', 'f-1'], validationPassed: false }), 0)
    expect(one).toEqual({ ready: false, kept: 0, reason: '1 item still needs action under this policy.' })
    expect(many).toEqual({ ready: false, kept: 0, reason: '2 items still need action under this policy.' })
  })

  it('reports an incomplete re-scan rather than residuals', () => {
    const readiness = sanitizeReadiness(makeSanitize({ postScan: makeScan({ status: 'partial' }), validationPassed: false }), 0)
    expect(readiness.ready).toBe(false)
    expect(readiness).toMatchObject({ reason: 'The re-scan did not finish, so this output is not validated.' })
  })

  it('reports a failed validation with no residuals as not validated', () => {
    const readiness = sanitizeReadiness(makeSanitize({ validationPassed: false }), 0)
    expect(readiness).toMatchObject({ ready: false, reason: 'The re-scan did not validate this output. See the notes below.' })
  })

  it('never says ready for a rejected redaction', () => {
    const readiness = sanitizeReadiness(makeSanitize({ status: 'rejected', sanitizedText: null, validationPassed: false }), 0)
    expect(readiness.ready).toBe(false)
  })
})

describe('sanitizedVerdict', () => {
  it('shows "Ready to send." with the sage tint when fully validated', () => {
    expect(sanitizedVerdict(makeSanitize(), 0)).toMatchObject({ headline: READY_HEADLINE, tint: 'sage' })
  })

  it('keeps "Ready to send." and sage when the user kept items (retained-items case)', () => {
    const verdict = sanitizedVerdict(makeSanitize(), 1)
    expect(verdict.headline).toBe(READY_HEADLINE)
    expect(verdict.tint).toBe('sage')
    expect(verdict.readiness).toEqual({ ready: true, kept: 1 })
  })

  it('shows the honest not-ready headline with the ember tint when residuals remain', () => {
    const verdict = sanitizedVerdict(makeSanitize({ residualFindingIds: ['f-0'], validationPassed: false }), 0)
    expect(verdict).toMatchObject({ headline: NOT_READY_HEADLINE, tint: 'ember', readiness: { ready: false } })
  })

  it('shows the not-ready headline with the ember tint when the redaction failed', () => {
    const verdict = sanitizedVerdict(makeSanitize({ status: 'failed', sanitizedText: null, validationPassed: false }), 2)
    expect(verdict).toMatchObject({ headline: NOT_READY_HEADLINE, tint: 'ember' })
  })

  it('never lets the headline and the tint disagree, across every case', () => {
    const results = [
      makeSanitize(),
      makeSanitize({ residualFindingIds: ['f-0'], validationPassed: false }),
      makeSanitize({ validationPassed: false }),
      makeSanitize({ postScan: makeScan({ status: 'partial' }), validationPassed: false }),
      makeSanitize({ postScan: null, validationPassed: false }),
      makeSanitize({ status: 'rejected', sanitizedText: null, validationPassed: false }),
    ]
    for (const result of results) {
      for (const kept of [0, 1, 4]) {
        const verdict = sanitizedVerdict(result, kept)
        expect(verdict.headline === READY_HEADLINE).toBe(verdict.tint === 'sage')
        expect(sanitizedTint(result, kept)).toBe(verdict.tint)
      }
    }
  })
})
