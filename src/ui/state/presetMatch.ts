/**
 * Which preset a policy still matches. Shared by the Policy screen and the policy store, so a stored label can
 * never claim "Strict" over rules that aren't Strict.
 */
import { PERMISSIVE_POLICY, STRICT_POLICY, type Policy, type PolicyRule } from '../../core'
import type { PolicyPreset } from './contexts'

/**
 * The preset the draft still matches. A preset is its id plus its mode, category rules, defaults and
 * scan-failure rule. Custom rules, the name and contextualAnalysis are not part of it.
 */
export function detectPreset(policy: Policy): PolicyPreset {
  if (policy.policyId === 'strict' && matchesPreset(policy, STRICT_POLICY)) return 'strict'
  if (policy.policyId === 'permissive' && matchesPreset(policy, PERMISSIVE_POLICY)) return 'permissive'
  return 'custom'
}

function matchesPreset(policy: Policy, preset: Policy): boolean {
  return (
    policy.mode === preset.mode &&
    policy.defaultAction === preset.defaultAction &&
    policy.lowConfidenceAction === preset.lowConfidenceAction &&
    policy.onScanFailure === preset.onScanFailure &&
    sameRules(policy.rules, preset.rules)
  )
}

function sameRules(actual: readonly PolicyRule[], expected: readonly PolicyRule[]): boolean {
  return (
    actual.length === expected.length &&
    expected.every((want) => {
      const have = actual.find((rule) => rule.category === want.category)
      return (
        have !== undefined &&
        have.action === want.action &&
        have.minConfidence === want.minConfidence &&
        have.mandatory === want.mandatory
      )
    })
  )
}
