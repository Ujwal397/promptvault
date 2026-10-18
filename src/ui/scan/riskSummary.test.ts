import { describe, expect, it } from 'vitest'
import { makeFinding, makeScan } from './scanFixtures'
import { bandTone, riskSummary, topReason } from './riskSummary'

describe('riskSummary', () => {
  it('titles the band and carries the score', () => {
    const summary = riskSummary(makeScan({ riskBand: 'high', riskScore: 82, reasonCodes: ['RULE_MATCH'], policyDecision: 'redact' }))
    expect(summary).toEqual({ title: 'High risk', score: 82, tone: 'ember', reason: null, blockNote: null })
  })

  it('says risk was not scored when there is no score', () => {
    const summary = riskSummary(makeScan({ status: 'partial', riskBand: null, riskScore: null }))
    expect(summary.title).toBe('Risk not scored')
    expect(summary.score).toBeNull()
  })

  it('says honestly when the policy blocks the prompt', () => {
    const summary = riskSummary(makeScan({ riskBand: 'critical', riskScore: 95, policyDecision: 'block' }))
    expect(summary.blockNote).toBe('Blocked by policy until these items are removed.')
  })
})

describe('bandTone', () => {
  it('maps high and critical to ember, medium to ochre and everything else to stone', () => {
    expect(bandTone('critical')).toBe('ember')
    expect(bandTone('high')).toBe('ember')
    expect(bandTone('medium')).toBe('ochre')
    expect(bandTone('low')).toBe('stone')
    expect(bandTone('none')).toBe('stone')
    expect(bandTone(null)).toBe('stone')
  })
})

describe('topReason', () => {
  it('describes the strongest real finding', () => {
    const scan = makeScan({
      findings: [
        makeFinding({ findingId: 'f-0', startOffset: 0, endOffset: 3, severity: 'low', confidence: 1, reasonCode: 'LUHN_VALID' }),
        makeFinding({
          findingId: 'f-1',
          startOffset: 5,
          endOffset: 9,
          severity: 'critical',
          confidence: 0.9,
          reasonCode: 'CONNECTION_STRING_PASSWORD',
        }),
      ],
    })
    expect(topReason(scan)).toBe('Password inside a connection string')
  })

  it('ignores obfuscation signals when choosing a reason', () => {
    const scan = makeScan({
      findings: [
        makeFinding({ findingId: 'f-0', startOffset: 0, endOffset: 1, category: 'obfuscation', reasonCode: 'INVISIBLE_CHARACTERS' }),
        makeFinding({ findingId: 'f-1', startOffset: 3, endOffset: 9, severity: 'low', reasonCode: 'EMAIL_FORMAT' }),
      ],
      reasonCodes: ['EMAIL_FORMAT', 'INVISIBLE_CHARACTERS'],
    })
    expect(topReason(scan)).toBe('Email address format')
  })

  it('falls back to a policy reason when no finding reason is known', () => {
    const scan = makeScan({
      findings: [makeFinding({ findingId: 'f-0', startOffset: 0, endOffset: 4, reasonCode: 'RULE_MATCH' })],
      reasonCodes: ['DEFAULT_ACTION', 'STRICT_CRITICAL_RISK'],
    })
    expect(topReason(scan)).toBe('Critical risk in strict mode')
  })

  it('returns null when nothing describable applies', () => {
    expect(topReason(makeScan({ reasonCodes: ['DEFAULT_ACTION'] }))).toBeNull()
  })
})
