import { describe, expect, it } from 'vitest'
import type { Category, Finding } from '../types'
import { evaluatePolicy } from './evaluate'
import { PERMISSIVE_POLICY, STRICT_POLICY } from './presets'

function f(id: string, category: Category, confidence = 0.95, reasonCode = 'R'): Finding {
  return {
    findingId: id, category, startOffset: 0, endOffset: 1, severity: 'high', confidence,
    detectorId: 'd', detectorVersion: '1.0.0', reasonCode, recommendedAction: 'redact',
    label: 'l', explanation: 'e', placeholderType: 'X', source: 'deterministic',
  }
}

const ok = { scanStatus: 'completed' as const, retainedFindingIds: [], riskBand: 'low' as const }

describe('evaluatePolicy', () => {
  it('allows when there are no findings', () => {
    const r = evaluatePolicy([], STRICT_POLICY, { ...ok, riskBand: 'none' })
    expect(r.policyDecision).toBe('allow')
    expect(r.reasonCodes).toEqual(['NO_FINDINGS'])
    expect(r.findingDecisions).toEqual([])
    expect(r.mandatoryRulesTriggered).toEqual([])
  })

  it('applies lowConfidenceAction below minConfidence', () => {
    const r = evaluatePolicy([f('f-0', 'email', 0.3)], STRICT_POLICY, ok)
    expect(r.findingDecisions[0]).toMatchObject({ action: 'review', reasonCode: 'BELOW_MIN_CONFIDENCE' })
    expect(r.policyDecision).toBe('review')
    const p = evaluatePolicy([f('f-0', 'email', 0.3)], PERMISSIVE_POLICY, ok)
    expect(p.policyDecision).toBe('allow')
  })

  it('does not trigger mandatory rules below confidence', () => {
    const r = evaluatePolicy([f('f-0', 'private_key', 0.5)], STRICT_POLICY, ok)
    expect(r.mandatoryRulesTriggered).toEqual([])
    expect(r.policyDecision).toBe('review')
  })

  it('uses the rule action and lists triggered mandatory rules', () => {
    const r = evaluatePolicy([f('f-0', 'private_key'), f('f-1', 'email')], STRICT_POLICY, ok)
    expect(r.policyDecision).toBe('block')
    expect(r.mandatoryRulesTriggered).toEqual(['private_key:block'])
    expect(r.findingDecisions[0]).toMatchObject({ mandatory: true, reasonCode: 'RULE_MATCH' })
  })

  it('lets users retain non-mandatory findings', () => {
    const r = evaluatePolicy([f('f-0', 'email')], STRICT_POLICY, { ...ok, retainedFindingIds: ['f-0'] })
    expect(r.findingDecisions[0]).toMatchObject({ action: 'allow', reasonCode: 'USER_RETAINED', retained: true })
    expect(r.policyDecision).toBe('allow')
  })

  it('denies retaining mandatory findings', () => {
    const r = evaluatePolicy([f('f-0', 'credential')], STRICT_POLICY, { ...ok, retainedFindingIds: ['f-0'] })
    expect(r.findingDecisions[0]).toMatchObject({ action: 'redact', reasonCode: 'RETAIN_DENIED_MANDATORY', retained: false })
    expect(r.policyDecision).toBe('redact')
    expect(r.reasonCodes).toContain('RETAIN_DENIED_MANDATORY')
  })

  it('escalates to review on strict critical band when below redact', () => {
    const r = evaluatePolicy([f('f-0', 'ip_address')], STRICT_POLICY, { ...ok, riskBand: 'critical' })
    expect(r.policyDecision).toBe('review')
    expect(r.reasonCodes).toContain('STRICT_CRITICAL_RISK')
    const p = evaluatePolicy([f('f-0', 'ip_address')], PERMISSIVE_POLICY, { ...ok, riskBand: 'critical' })
    expect(p.policyDecision).toBe('allow')
  })

  it('does not lower a mandatory action on critical band', () => {
    const r = evaluatePolicy([f('f-0', 'credential')], STRICT_POLICY, { ...ok, riskBand: 'critical' })
    expect(r.policyDecision).toBe('redact')
    expect(r.reasonCodes).not.toContain('STRICT_CRITICAL_RISK')
  })

  it('handles partial scans per policy, never below a finding-derived block', () => {
    const base = { ...ok, scanStatus: 'partial' as const, riskBand: null }
    expect(evaluatePolicy([], STRICT_POLICY, base).policyDecision).toBe('block')
    const perm = evaluatePolicy([], PERMISSIVE_POLICY, base)
    expect(perm.policyDecision).toBe('block')
    expect(perm.reasonCodes).toContain('SCAN_INCOMPLETE')
    expect(perm.reasonCodes).not.toContain('NO_FINDINGS')
    expect(evaluatePolicy([f('f-0', 'private_key')], PERMISSIVE_POLICY, base).policyDecision).toBe('block')
  })

  it('uses defaultAction for categories without a rule', () => {
    const policy = { ...STRICT_POLICY, rules: STRICT_POLICY.rules.filter((r) => r.category !== 'email') }
    const r = evaluatePolicy([f('f-0', 'email')], policy, ok)
    expect(r.findingDecisions[0]).toMatchObject({ action: 'review', reasonCode: 'DEFAULT_ACTION' })
  })

  it('merges finding reason codes, dedupes and sorts; is deterministic', () => {
    const findings = [f('f-0', 'email', 0.9, 'ZZZ'), f('f-1', 'phone', 0.9, 'ZZZ'), f('f-2', 'email', 0.9, 'AAA')]
    const a = evaluatePolicy(findings, STRICT_POLICY, ok)
    const b = evaluatePolicy(findings, STRICT_POLICY, ok)
    expect(a).toEqual(b)
    expect(a.reasonCodes).toEqual(['AAA', 'RULE_MATCH', 'ZZZ'])
  })
})
