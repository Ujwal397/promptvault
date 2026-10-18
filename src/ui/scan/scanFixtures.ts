/**
 * Synthetic builders for the Scan flow's unit tests. Test-only: nothing here is imported by the app.
 * Values are synthetic (example.com addresses, obviously fake keys assembled from parts).
 */
import type { Finding, FindingDecision, PolicyAction, Replacement, SanitizeResult, ScanResult } from '../../core'

export function makeFinding(overrides: Partial<Finding> & Pick<Finding, 'findingId' | 'startOffset' | 'endOffset'>): Finding {
  return {
    category: 'email',
    severity: 'medium',
    confidence: 0.99,
    detectorId: 'pii.email',
    detectorVersion: '1.0.0',
    reasonCode: 'EMAIL_FORMAT',
    recommendedAction: 'redact',
    label: 'Email address',
    explanation: 'Matches an email address shape.',
    placeholderType: 'EMAIL',
    source: 'deterministic',
    ...overrides,
  }
}

export function makeDecision(
  findingId: string,
  action: PolicyAction,
  overrides: Partial<FindingDecision> = {},
): FindingDecision {
  return { findingId, action, reasonCode: 'RULE_MATCH', mandatory: false, retained: false, ...overrides }
}

export function makeScan(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    requestId: 'req-1',
    status: 'completed',
    findings: [],
    riskScore: 0,
    riskBand: 'none',
    policyDecision: 'allow',
    findingDecisions: [],
    reasonCodes: ['NO_FINDINGS'],
    mandatoryRulesTriggered: [],
    detectorVersions: {},
    errors: [],
    durationMs: 1,
    policyId: 'strict',
    policyVersion: '1.0.0',
    coreVersion: '1.0.0',
    ...overrides,
  }
}

export function makeReplacement(findingId: string, placeholder: string, start: number, end: number): Replacement {
  return { findingId, placeholder, start, end }
}

export function makeSanitize(overrides: Partial<SanitizeResult> = {}): SanitizeResult {
  return {
    status: 'completed',
    sanitizedText: '',
    replacements: [],
    residualFindingIds: [],
    postScan: makeScan({ requestId: 'req-1:post' }),
    validationPassed: true,
    residualRiskNotes: ['Semantic risk note.'],
    errors: [],
    ...overrides,
  }
}
