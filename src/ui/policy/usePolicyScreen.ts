import { useState } from 'react'
import type { Category, Policy, PolicyAction } from '../../core'
import { usePolicy, type PolicyPreset } from '../state/contexts'
import {
  addCustomRule,
  detectPreset,
  draftForPreset,
  importedDraft,
  isSamePolicy,
  normalizeDraft,
  removeCustomRule,
  setCustomRuleEnabled,
  setDefaultAction,
  setLowConfidenceAction,
  setRuleAction,
} from './draft'
import { checkCustomRule, newRuleId, type CustomRuleErrors, type CustomRuleInput } from './customRules'
import { downloadPolicyJson } from './exportPolicy'
import { IMPORT_MAX_AGE_DAYS, importPolicyFile } from './importPolicy'
import type { LowConfidenceAction } from './rules'
import { TRUSTED_POLICY_KEYS } from './trustedKeys'
import { readJson, STORAGE_KEYS, writeJson } from '../state/storage'

function loadSequence(): number {
  const raw = readJson(STORAGE_KEYS.policySequence)
  return typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 0 ? raw : 0
}

export interface Notice {
  tone: 'ok' | 'error'
  text: string
}

export interface PolicyScreenModel {
  draft: Policy
  preset: PolicyPreset
  dirty: boolean
  importing: boolean
  notice: Notice | null
  onPreset: (preset: PolicyPreset) => void
  onRuleAction: (category: Category, action: PolicyAction) => void
  onDefaultAction: (action: PolicyAction) => void
  onLowConfidenceAction: (action: LowConfidenceAction) => void
  onAddCustomRule: (input: CustomRuleInput) => CustomRuleErrors | null
  onToggleCustomRule: (id: string, enabled: boolean) => void
  onRemoveCustomRule: (id: string) => void
  onSave: () => void
  onDiscard: () => void
  onExport: () => void
  onImportFile: (file: File) => void
}

/**
 * Policy tab state. `edit` is null while the draft equals the saved policy, so the draft follows the saved
 * policy until the user changes something. Nothing reaches storage except through "Save policy".
 */
export function usePolicyScreen(): PolicyScreenModel {
  const { policy: saved, applyPolicy } = usePolicy()
  const [edit, setEdit] = useState<Policy | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [lastCustom, setLastCustom] = useState<Policy | null>(null)
  const [importing, setImporting] = useState(false)
  // Persisted (a number, not sensitive), so a rolled-back bundle stays rejected after a reload.
  const [lastSequence, setLastSequence] = useState(loadSequence)

  const draft = edit ?? normalizeDraft(saved)
  const dirty = !isSamePolicy(draft, saved)

  const change = (next: Policy): void => {
    setEdit(next)
    setNotice(null)
  }

  // Leaving a custom draft for a preset remembers it, so picking Custom again brings the user's edits back.
  const selectPreset = (preset: PolicyPreset): void => {
    if (preset !== 'custom' && detectPreset(draft) === 'custom') setLastCustom(draft)
    change(draftForPreset(draft, preset, lastCustom))
  }

  const addRule = (input: CustomRuleInput): CustomRuleErrors | null => {
    const id = newRuleId(new Set(draft.customRules.map((rule) => rule.id)))
    if (id === null) return { form: 'Could not create the rule. Try again.' }
    const checked = checkCustomRule(input, id, draft.customRules.length)
    if (!checked.ok) return checked.errors
    change(addCustomRule(draft, checked.rule))
    return null
  }

  const save = (): void => {
    const result = applyPolicy(draft, detectPreset(draft))
    if (result.ok) {
      setEdit(null)
      setNotice({ tone: 'ok', text: 'Policy saved.' })
    } else {
      setNotice({ tone: 'error', text: `Not saved. ${result.message}` })
    }
  }

  const importFile = async (file: File): Promise<void> => {
    setImporting(true)
    try {
      const outcome = await importPolicyFile(file, {
        keys: TRUSTED_POLICY_KEYS,
        minSequence: lastSequence,
        maxAgeDays: IMPORT_MAX_AGE_DAYS,
      })
      if (!outcome.ok) {
        setNotice({ tone: 'error', text: `Import rejected. ${outcome.message}` })
        return
      }
      const next = Math.max(lastSequence, outcome.sequence)
      setLastSequence(next)
      writeJson(STORAGE_KEYS.policySequence, next)
      change(importedDraft(outcome.policy, draft))
      setNotice({ tone: 'ok', text: 'Signed policy loaded into the draft. Review it, then save.' })
    } finally {
      setImporting(false)
    }
  }

  return {
    draft,
    preset: detectPreset(draft),
    dirty,
    importing,
    notice,
    onPreset: selectPreset,
    onRuleAction: (category, action) => change(setRuleAction(draft, category, action)),
    onDefaultAction: (action) => change(setDefaultAction(draft, action)),
    onLowConfidenceAction: (action) => change(setLowConfidenceAction(draft, action)),
    onAddCustomRule: addRule,
    onToggleCustomRule: (id, enabled) => change(setCustomRuleEnabled(draft, id, enabled)),
    onRemoveCustomRule: (id) => change(removeCustomRule(draft, id)),
    onSave: save,
    onDiscard: () => {
      setEdit(null)
      setNotice(null)
    },
    onExport: () => downloadPolicyJson(saved),
    onImportFile: (file) => void importFile(file),
  }
}
