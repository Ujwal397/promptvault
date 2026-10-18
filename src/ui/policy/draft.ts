/**
 * Pure helpers for the Policy draft. The screen edits a copy of the saved policy. Nothing here touches
 * storage or the engine, and every helper returns a new object instead of mutating its input.
 */
import {
  PERMISSIVE_POLICY,
  STRICT_POLICY,
  type Category,
  type CustomRule,
  type Policy,
  type PolicyAction,
} from '../../core'
import type { PolicyPreset } from '../state/contexts'
import { detectPreset } from '../state/presetMatch'
import { isLockedCategory, type LowConfidenceAction } from './rules'

export { detectPreset }

export type EditablePreset = Exclude<PolicyPreset, 'custom'>

export const PRESET_OPTIONS: readonly { preset: PolicyPreset; label: string }[] = [
  { preset: 'strict', label: 'Strict' },
  { preset: 'permissive', label: 'Permissive' },
  { preset: 'custom', label: 'Custom' },
]

const PRESETS: Record<EditablePreset, Policy> = { strict: STRICT_POLICY, permissive: PERMISSIVE_POLICY }
const CUSTOM_ID = 'custom'
const CUSTOM_NAME = 'Custom'

/** The scan-failure rule is fixed: an unchecked prompt is always blocked, whatever was saved or imported. */
export function normalizeDraft(policy: Policy): Policy {
  return policy.onScanFailure === 'block' ? policy : { ...policy, onScanFailure: 'block' }
}

/** Any edit makes the policy custom, so the preset label never describes rules that were changed. */
export function markCustom(policy: Policy): Policy {
  return { ...policy, policyId: CUSTOM_ID, name: CUSTOM_NAME }
}

/**
 * Loads a preset's mode, rules and defaults into the draft. Custom rules and contextualAnalysis are kept:
 * the first are the user's own terms, and the second belongs to Settings ("Spot names").
 */
export function loadPreset(draft: Policy, preset: EditablePreset): Policy {
  const base = PRESETS[preset]
  return normalizeDraft({ ...base, customRules: draft.customRules, contextualAnalysis: draft.contextualAnalysis })
}

/**
 * The draft after picking a preset. Strict/Permissive load that preset. Custom brings back the custom draft the
 * user just left (if any), otherwise it turns the current rules into an editable custom copy. Already custom: no-op.
 */
export function draftForPreset(draft: Policy, preset: PolicyPreset, lastCustom: Policy | null): Policy {
  if (preset !== 'custom') return loadPreset(draft, preset)
  if (detectPreset(draft) === 'custom') return draft
  return lastCustom ?? markCustom(draft)
}

/**
 * A signed policy loaded into the draft. It is custom, scan failures stay blocked, and the draft's own
 * contextualAnalysis is kept, because Settings ("Spot names") owns that value.
 */
export function importedDraft(imported: Policy, current: Policy): Policy {
  return markCustom(normalizeDraft({ ...imported, contextualAnalysis: current.contextualAnalysis }))
}

/** Changes one category's action. Safety-floor categories and categories with no rule are left alone. */
export function setRuleAction(policy: Policy, category: Category, action: PolicyAction): Policy {
  if (isLockedCategory(category)) return policy
  const current = policy.rules.find((rule) => rule.category === category)
  if (!current || current.action === action) return policy
  const rules = policy.rules.map((rule) => (rule.category === category ? { ...rule, action } : rule))
  return markCustom({ ...policy, rules })
}

export function setDefaultAction(policy: Policy, defaultAction: PolicyAction): Policy {
  return policy.defaultAction === defaultAction ? policy : markCustom({ ...policy, defaultAction })
}

export function setLowConfidenceAction(policy: Policy, lowConfidenceAction: LowConfidenceAction): Policy {
  return policy.lowConfidenceAction === lowConfidenceAction ? policy : markCustom({ ...policy, lowConfidenceAction })
}

export function addCustomRule(policy: Policy, rule: CustomRule): Policy {
  return markCustom({ ...policy, customRules: [...policy.customRules, rule] })
}

export function setCustomRuleEnabled(policy: Policy, id: string, enabled: boolean): Policy {
  const target = policy.customRules.find((rule) => rule.id === id)
  if (!target || target.enabled === enabled) return policy
  const customRules = policy.customRules.map((rule) => (rule.id === id ? { ...rule, enabled } : rule))
  return markCustom({ ...policy, customRules })
}

export function removeCustomRule(policy: Policy, id: string): Policy {
  if (!policy.customRules.some((rule) => rule.id === id)) return policy
  return markCustom({ ...policy, customRules: policy.customRules.filter((rule) => rule.id !== id) })
}

/** Structural equality of two policies. Keys are compared in sorted order, so key order does not matter. */
export function isSamePolicy(a: Policy, b: Policy): boolean {
  return stableJson(a) === stableJson(b)
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const body = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    return `{${body.join(',')}}`
  }
  return JSON.stringify(value)
}
