import {
  ACTION_PRECEDENCE,
  type Finding,
  type FindingDecision,
  type Policy,
  type PolicyAction,
  type PolicyRule,
  type RiskBand,
  type ScanResult,
} from '../types'

export interface EvaluateContext {
  scanStatus: ScanResult['status']
  retainedFindingIds: string[]
  riskBand: RiskBand | null
}

export interface EvaluateResult {
  policyDecision: PolicyAction
  findingDecisions: FindingDecision[]
  reasonCodes: string[]
  mandatoryRulesTriggered: string[]
}

function stricter(a: PolicyAction, b: PolicyAction): PolicyAction {
  return ACTION_PRECEDENCE[b] > ACTION_PRECEDENCE[a] ? b : a
}

function decide(
  finding: Finding,
  rule: PolicyRule | undefined,
  policy: Policy,
  retained: ReadonlySet<string>,
): FindingDecision {
  const base = { findingId: finding.findingId }
  if (!rule) {
    const isRetained = retained.has(finding.findingId)
    return isRetained
      ? { ...base, action: 'allow', reasonCode: 'USER_RETAINED', mandatory: false, retained: true }
      : { ...base, action: policy.defaultAction, reasonCode: 'DEFAULT_ACTION', mandatory: false, retained: false }
  }
  const met = finding.confidence >= rule.minConfidence
  // Mandatory categories stay mandatory below the confidence threshold: an uncertain credential is never
  // silently allowed or retainable. It drops to review (strict) or warn (permissive) instead of the rule's action.
  const mandatory = rule.mandatory
  const uncertainFloor: PolicyAction = policy.mode === 'strict' ? 'review' : 'warn'
  // Contextual (model/NLP) findings are advisory: when uncertain they may warn but never escalate to review/block.
  const advisoryLow: PolicyAction = ACTION_PRECEDENCE[policy.lowConfidenceAction] > ACTION_PRECEDENCE.warn ? 'warn' : policy.lowConfidenceAction
  const baseLow = finding.source === 'contextual' ? advisoryLow : policy.lowConfidenceAction
  const lowAction = mandatory ? stricter(baseLow, uncertainFloor) : baseLow
  const action = met ? rule.action : lowAction
  const reasonCode = met ? 'RULE_MATCH' : 'BELOW_MIN_CONFIDENCE'
  if (retained.has(finding.findingId)) {
    if (mandatory) return { ...base, action, reasonCode: 'RETAIN_DENIED_MANDATORY', mandatory, retained: false }
    return { ...base, action: 'allow', reasonCode: 'USER_RETAINED', mandatory, retained: true }
  }
  return { ...base, action, reasonCode, mandatory, retained: false }
}

function mandatoryTriggered(findings: Finding[], policy: Policy): string[] {
  const out = new Set<string>()
  for (const rule of policy.rules) {
    if (!rule.mandatory) continue
    if (findings.some((f) => f.category === rule.category && f.confidence >= rule.minConfidence)) {
      out.add(`${rule.category}:${rule.action}`)
    }
  }
  return [...out].sort()
}

export function evaluatePolicy(findings: Finding[], policy: Policy, ctx: EvaluateContext): EvaluateResult {
  const retained = new Set(ctx.retainedFindingIds)
  const ruleByCategory = new Map(policy.rules.map((r) => [r.category, r] as const))
  const findingDecisions = findings.map((f) => decide(f, ruleByCategory.get(f.category), policy, retained))

  const reasons = new Set<string>(findings.map((f) => f.reasonCode))
  for (const d of findingDecisions) reasons.add(d.reasonCode)

  let aggregate: PolicyAction = 'allow'
  for (const d of findingDecisions) aggregate = stricter(aggregate, d.action)

  if (findings.length === 0 && ctx.scanStatus === 'completed') reasons.add('NO_FINDINGS')

  if (
    policy.mode === 'strict' &&
    ctx.riskBand === 'critical' &&
    ACTION_PRECEDENCE[aggregate] < ACTION_PRECEDENCE.redact
  ) {
    aggregate = 'review'
    reasons.add('STRICT_CRITICAL_RISK')
  }

  if (ctx.scanStatus !== 'completed') {
    aggregate = stricter(aggregate, policy.onScanFailure)
    reasons.add('SCAN_INCOMPLETE')
  }

  return {
    policyDecision: aggregate,
    findingDecisions,
    reasonCodes: [...reasons].sort(),
    mandatoryRulesTriggered: mandatoryTriggered(findings, policy),
  }
}
