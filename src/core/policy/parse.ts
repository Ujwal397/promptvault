import { ACTION_PRECEDENCE, PolicySchema, type Category, type EngineError, type Policy } from '../types'

/** Non-negotiable safety floor: no user/org policy may allow raw secrets through (FR-025). */
export const SECRET_FLOOR: readonly Category[] = [
  'credential',
  'cloud_credential',
  'private_key',
  'crypto_seed',
  'db_connection',
]

export type ParsePolicyResult = { ok: true; policy: Policy } | { ok: false; error: EngineError }

function fail(message: string): ParsePolicyResult {
  return { ok: false, error: { code: 'POLICY_INVALID', message } }
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length
}

/** Validates an unknown value as a Policy. Never falls back to a default policy. */
export function parsePolicy(input: unknown): ParsePolicyResult {
  const parsed = PolicySchema.safeParse(input)
  if (!parsed.success) {
    const paths = [...new Set(parsed.error.issues.map((i) => (i.path.length ? i.path.join('.') : '(root)')))]
    return fail(`Policy is invalid at: ${paths.join(', ')}`)
  }
  const policy = parsed.data
  if (hasDuplicates(policy.rules.map((r) => r.category))) {
    return fail('Policy is invalid: duplicate category rules')
  }
  if (hasDuplicates(policy.customRules.map((r) => r.id))) {
    return fail('Policy is invalid: duplicate custom rule ids')
  }
  const floorViolation = SECRET_FLOOR.find((cat) => {
    const rule = policy.rules.find((r) => r.category === cat)
    return !rule || !rule.mandatory || ACTION_PRECEDENCE[rule.action] < ACTION_PRECEDENCE.redact
  })
  if (floorViolation) {
    return fail(`Policy is invalid: ${floorViolation} must have a mandatory redact or block rule`)
  }
  return { ok: true, policy }
}
