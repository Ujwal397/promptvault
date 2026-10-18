import { ACTIONS, SECRET_FLOOR, type Category, type PolicyAction } from '../../core'

export interface RuleRowSpec {
  category: Category
  label: string
}

/**
 * Rows of the Rules table, in display order. `obfuscation` is an advisory signal and has no row; its rule
 * stays in the draft unchanged. `custom` has a row because it sets what custom-rule matches do.
 */
export const RULE_ROWS: readonly RuleRowSpec[] = [
  { category: 'private_key', label: 'Private keys' },
  { category: 'crypto_seed', label: 'Crypto seed phrases' },
  { category: 'credential', label: 'Passwords & API keys' },
  { category: 'cloud_credential', label: 'Cloud credentials' },
  { category: 'db_connection', label: 'Database connections' },
  { category: 'gov_id', label: 'Government IDs' },
  { category: 'financial', label: 'Financial details' },
  { category: 'health', label: 'Health information' },
  { category: 'email', label: 'Email addresses' },
  { category: 'phone', label: 'Phone numbers' },
  { category: 'person_name', label: 'Names' },
  { category: 'ip_address', label: 'IP addresses' },
  { category: 'custom', label: 'Custom rule matches' },
]

export const ACTION_LABELS: Record<PolicyAction, string> = {
  allow: 'Allow',
  warn: 'Warn',
  redact: 'Redact',
  review: 'Ask me to review',
  block: 'Block',
}

export const LOW_CONFIDENCE_ACTIONS = ['allow', 'warn', 'review'] as const
export type LowConfidenceAction = (typeof LOW_CONFIDENCE_ACTIONS)[number]

export interface ActionOption<T extends string> {
  value: T
  label: string
}

export const ACTION_OPTIONS: readonly ActionOption<PolicyAction>[] = ACTIONS.map((value) => ({
  value,
  label: ACTION_LABELS[value],
}))

export const LOW_CONFIDENCE_OPTIONS: readonly ActionOption<LowConfidenceAction>[] = LOW_CONFIDENCE_ACTIONS.map(
  (value) => ({ value, label: ACTION_LABELS[value] }),
)

/** Safety-floor categories (SECRET_FLOOR) cannot be relaxed. parsePolicy enforces the same rule. */
export function isLockedCategory(category: Category): boolean {
  return SECRET_FLOOR.includes(category)
}

/** Short reason shown on a locked row. */
export function lockedReason(action: PolicyAction): string {
  return action === 'block' ? 'Safety floor: always blocked' : 'Safety floor: always removed'
}

/** A locked row offers only its current action, so the disabled control shows the real value. */
export function actionOptionsFor(category: Category, current: PolicyAction): readonly ActionOption<PolicyAction>[] {
  if (isLockedCategory(category)) return [{ value: current, label: ACTION_LABELS[current] }]
  return ACTION_OPTIONS
}

/** Returns the option equal to `value`, or null for anything else (form values are untrusted strings). */
export function pick<T extends string>(options: readonly T[], value: string): T | null {
  return options.find((option) => option === value) ?? null
}

export function toAction(value: string): PolicyAction | null {
  return pick(ACTIONS, value)
}

export function toLowConfidenceAction(value: string): LowConfidenceAction | null {
  return pick(LOW_CONFIDENCE_ACTIONS, value)
}
