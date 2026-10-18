import { CATEGORIES, type Category, type Policy, type PolicyAction, type PolicyRule } from '../types'

type RuleSpec = readonly [PolicyAction, number, boolean]

function buildRules(spec: Record<Category, RuleSpec>): PolicyRule[] {
  return CATEGORIES.map((category) => {
    const [action, minConfidence, mandatory] = spec[category]
    return { category, action, minConfidence, mandatory }
  })
}

export const STRICT_POLICY: Policy = {
  policyId: 'strict',
  policyVersion: '1.0.0',
  name: 'Strict',
  mode: 'strict',
  rules: buildRules({
    private_key: ['block', 0.7, true],
    crypto_seed: ['block', 0.7, true],
    cloud_credential: ['redact', 0.7, true],
    credential: ['redact', 0.7, true],
    db_connection: ['redact', 0.7, true],
    gov_id: ['redact', 0.7, true],
    financial: ['redact', 0.7, true],
    health: ['redact', 0.7, true],
    email: ['redact', 0.6, false],
    phone: ['redact', 0.6, false],
    person_name: ['redact', 0.6, false],
    ip_address: ['warn', 0.6, false],
    custom: ['review', 0.6, false],
    obfuscation: ['warn', 0.5, false],
  }),
  defaultAction: 'review',
  lowConfidenceAction: 'review',
  onScanFailure: 'block',
  postRedactionValidationRequired: true,
  contextualAnalysis: true,
  customRules: [],
}

export const PERMISSIVE_POLICY: Policy = {
  policyId: 'permissive',
  policyVersion: '1.0.0',
  name: 'Permissive',
  mode: 'permissive',
  rules: buildRules({
    private_key: ['block', 0.7, true],
    crypto_seed: ['block', 0.7, true],
    cloud_credential: ['redact', 0.75, true],
    credential: ['redact', 0.75, true],
    db_connection: ['redact', 0.75, true],
    gov_id: ['warn', 0.7, false],
    financial: ['warn', 0.7, false],
    health: ['warn', 0.7, false],
    email: ['warn', 0.6, false],
    phone: ['warn', 0.6, false],
    person_name: ['warn', 0.6, false],
    ip_address: ['allow', 0.6, false],
    custom: ['warn', 0.6, false],
    obfuscation: ['warn', 0.5, false],
  }),
  defaultAction: 'warn',
  lowConfidenceAction: 'allow',
  onScanFailure: 'block', // unscanned text is never waved through, even in permissive mode
  postRedactionValidationRequired: true,
  contextualAnalysis: false,
  customRules: [],
}

export const POLICY_PRESETS: Record<'strict' | 'permissive', Policy> = {
  strict: STRICT_POLICY,
  permissive: PERMISSIVE_POLICY,
}
