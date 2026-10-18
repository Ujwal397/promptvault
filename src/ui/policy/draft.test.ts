import { describe, expect, it } from 'vitest'
import { PERMISSIVE_POLICY, STRICT_POLICY, parsePolicy, type CustomRule, type Policy } from '../../core'
import {
  addCustomRule,
  detectPreset,
  draftForPreset,
  importedDraft,
  isSamePolicy,
  loadPreset,
  markCustom,
  normalizeDraft,
  removeCustomRule,
  setCustomRuleEnabled,
  setDefaultAction,
  setLowConfidenceAction,
  setRuleAction,
} from './draft'

const RULE: CustomRule = {
  id: 'rule-test',
  name: 'Project codename',
  kind: 'keyword',
  pattern: 'Bluebird',
  caseSensitive: false,
  severity: 'medium',
  placeholderType: 'PROJECT',
  enabled: true,
}

function withRules(policy: Policy, rules: Policy['rules']): Policy {
  return { ...policy, rules }
}

describe('detectPreset', () => {
  it('recognises the untouched Strict and Permissive presets', () => {
    expect(detectPreset(STRICT_POLICY)).toBe('strict')
    expect(detectPreset(PERMISSIVE_POLICY)).toBe('permissive')
  })

  it('treats a changed category action as custom', () => {
    expect(detectPreset(setRuleAction(STRICT_POLICY, 'email', 'block'))).toBe('custom')
  })

  it('treats a changed default or low-confidence action as custom', () => {
    expect(detectPreset(setDefaultAction(STRICT_POLICY, 'warn'))).toBe('custom')
    expect(detectPreset(setLowConfidenceAction(STRICT_POLICY, 'allow'))).toBe('custom')
  })

  it('treats any scan-failure rule other than block as custom', () => {
    expect(detectPreset({ ...STRICT_POLICY, onScanFailure: 'warn' })).toBe('custom')
  })

  it('treats a policy with another id as custom, even when its rules match a preset', () => {
    expect(detectPreset({ ...STRICT_POLICY, policyId: 'acme-standard' })).toBe('custom')
  })

  it('does not count custom rules or contextualAnalysis as part of a preset', () => {
    expect(detectPreset({ ...STRICT_POLICY, customRules: [RULE] })).toBe('strict')
    expect(detectPreset({ ...PERMISSIVE_POLICY, contextualAnalysis: true })).toBe('permissive')
  })

  it('marks the draft custom once a custom rule is added through the draft helpers', () => {
    expect(detectPreset(addCustomRule(STRICT_POLICY, RULE))).toBe('custom')
  })
})

describe('loadPreset', () => {
  it('loads the preset rules, defaults and mode into the draft', () => {
    const edited = setRuleAction(STRICT_POLICY, 'email', 'block')
    const loaded = loadPreset(edited, 'permissive')
    expect(loaded.rules).toEqual(PERMISSIVE_POLICY.rules)
    expect(loaded.mode).toBe('permissive')
    expect(detectPreset(loaded)).toBe('permissive')
  })

  it('keeps the draft custom rules and contextualAnalysis, which the preset does not own', () => {
    const draft = { ...addCustomRule(STRICT_POLICY, RULE), contextualAnalysis: true }
    const loaded = loadPreset(draft, 'strict')
    expect(loaded.customRules).toEqual([RULE])
    expect(loaded.contextualAnalysis).toBe(true)
  })

  it('always keeps scan failures blocked', () => {
    expect(loadPreset({ ...STRICT_POLICY, onScanFailure: 'warn' }, 'permissive').onScanFailure).toBe('block')
  })

  it('does not change the preset constants', () => {
    const before = JSON.stringify(STRICT_POLICY)
    const loaded = loadPreset(addCustomRule(PERMISSIVE_POLICY, RULE), 'strict')
    expect(loaded).not.toBe(STRICT_POLICY)
    expect(JSON.stringify(STRICT_POLICY)).toBe(before)
  })
})

describe('safety-floor rows in the draft', () => {
  it('refuses to change a safety-floor category and returns the same draft', () => {
    expect(setRuleAction(STRICT_POLICY, 'credential', 'allow')).toBe(STRICT_POLICY)
    expect(setRuleAction(STRICT_POLICY, 'private_key', 'warn')).toBe(STRICT_POLICY)
  })

  it('changes an ordinary category and makes the draft custom', () => {
    const next = setRuleAction(STRICT_POLICY, 'email', 'block')
    expect(next.rules.find((rule) => rule.category === 'email')?.action).toBe('block')
    expect(next.policyId).toBe('custom')
  })

  it('returns the same draft when the action is already set, or the category has no rule', () => {
    expect(setRuleAction(STRICT_POLICY, 'email', 'redact')).toBe(STRICT_POLICY)
    const withoutHealth = withRules(
      STRICT_POLICY,
      STRICT_POLICY.rules.filter((rule) => rule.category !== 'health'),
    )
    expect(setRuleAction(withoutHealth, 'health', 'warn')).toBe(withoutHealth)
  })

  it('keeps an edited draft valid for parsePolicy', () => {
    expect(parsePolicy(setRuleAction(STRICT_POLICY, 'email', 'block')).ok).toBe(true)
  })

  it('makes parsePolicy reject a safety-floor rule that was relaxed by hand', () => {
    const relaxed = withRules(
      STRICT_POLICY,
      STRICT_POLICY.rules.map((rule) => (rule.category === 'credential' ? { ...rule, action: 'warn' as const } : rule)),
    )
    expect(parsePolicy(relaxed).ok).toBe(false)
  })
})

describe('when-unsure and custom-rule edits', () => {
  it('sets the default and low-confidence actions, and returns the same draft when unchanged', () => {
    expect(setDefaultAction(STRICT_POLICY, 'review')).toBe(STRICT_POLICY)
    expect(setDefaultAction(STRICT_POLICY, 'allow').defaultAction).toBe('allow')
    expect(setLowConfidenceAction(STRICT_POLICY, 'review')).toBe(STRICT_POLICY)
    expect(setLowConfidenceAction(STRICT_POLICY, 'warn').lowConfidenceAction).toBe('warn')
  })

  it('adds, toggles and removes custom rules immutably', () => {
    const added = addCustomRule(STRICT_POLICY, RULE)
    expect(added.customRules).toEqual([RULE])
    expect(STRICT_POLICY.customRules).toEqual([])

    const disabled = setCustomRuleEnabled(added, RULE.id, false)
    expect(disabled.customRules[0]?.enabled).toBe(false)
    expect(added.customRules[0]?.enabled).toBe(true)
    expect(setCustomRuleEnabled(added, RULE.id, true)).toBe(added)
    expect(setCustomRuleEnabled(added, 'missing', false)).toBe(added)

    const removed = removeCustomRule(added, RULE.id)
    expect(removed.customRules).toEqual([])
    expect(removeCustomRule(added, 'missing')).toBe(added)
  })
})

describe('importedDraft', () => {
  it('loads a signed policy as custom, with scan failures blocked', () => {
    const imported = { ...PERMISSIVE_POLICY, onScanFailure: 'warn' as const }
    const loaded = importedDraft(imported, STRICT_POLICY)
    expect(loaded.policyId).toBe('custom')
    expect(loaded.name).toBe('Custom')
    expect(loaded.rules).toEqual(PERMISSIVE_POLICY.rules)
    expect(loaded.onScanFailure).toBe('block')
  })

  it('keeps the draft contextualAnalysis, which Settings owns, instead of the signed value', () => {
    const current = { ...STRICT_POLICY, contextualAnalysis: false }
    expect(importedDraft({ ...STRICT_POLICY, contextualAnalysis: true }, current).contextualAnalysis).toBe(false)
  })
})

describe('normalizeDraft, markCustom and isSamePolicy', () => {
  it('forces the scan-failure rule to block and returns the same object when it already does', () => {
    expect(normalizeDraft(STRICT_POLICY)).toBe(STRICT_POLICY)
    expect(normalizeDraft({ ...STRICT_POLICY, onScanFailure: 'warn' }).onScanFailure).toBe('block')
  })

  it('markCustom changes only the id and name', () => {
    const marked = markCustom(STRICT_POLICY)
    expect(marked.policyId).toBe('custom')
    expect(marked.name).toBe('Custom')
    expect(marked.rules).toBe(STRICT_POLICY.rules)
  })

  it('compares policies by content, ignoring key order', () => {
    const reordered: Policy = {
      ...STRICT_POLICY,
      rules: STRICT_POLICY.rules.map((rule) => ({
        mandatory: rule.mandatory,
        minConfidence: rule.minConfidence,
        action: rule.action,
        category: rule.category,
      })),
    }
    expect(isSamePolicy(reordered, STRICT_POLICY)).toBe(true)
    expect(isSamePolicy(setRuleAction(STRICT_POLICY, 'email', 'block'), STRICT_POLICY)).toBe(false)
  })
})

describe('draftForPreset (Custom is always reachable)', () => {
  it('turns a preset into an editable custom copy with the same rules', () => {
    const next = draftForPreset(PERMISSIVE_POLICY, 'custom', null)
    expect(detectPreset(next)).toBe('custom')
    expect(next.rules).toEqual(PERMISSIVE_POLICY.rules)
  })

  it('brings back the custom draft the user just left', () => {
    const custom = addCustomRule(STRICT_POLICY, RULE)
    const onPermissive = draftForPreset(custom, 'permissive', null)
    expect(detectPreset(onPermissive)).toBe('permissive')
    expect(draftForPreset(onPermissive, 'custom', custom)).toBe(custom)
  })

  it('leaves an already custom draft alone', () => {
    const custom = markCustom(STRICT_POLICY)
    expect(draftForPreset(custom, 'custom', null)).toBe(custom)
  })

  it('still loads Strict and Permissive', () => {
    expect(detectPreset(draftForPreset(markCustom(STRICT_POLICY), 'permissive', null))).toBe('permissive')
  })
})
