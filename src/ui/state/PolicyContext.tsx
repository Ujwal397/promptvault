import { useCallback, useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { parsePolicy, STRICT_POLICY, type Policy } from '../../core'
import { PolicyContext, type ApplyPolicyResult, type PolicyPreset } from './contexts'
import { detectPreset } from './presetMatch'
import { readJson, removeKey, STORAGE_KEYS, writeJson } from './storage'

interface Saved {
  preset: PolicyPreset
  policy: Policy
}

const DEFAULT: Saved = { preset: 'strict', policy: STRICT_POLICY }

/** parsePolicy plus the app's fail-closed rule: a scan failure always blocks (fail closed), whatever the source. */
function validate(input: unknown): ApplyPolicyResult & { policy?: Policy } {
  const parsed = parsePolicy(input)
  if (!parsed.ok) return { ok: false, message: parsed.error.message }
  if (parsed.policy.onScanFailure !== 'block') {
    return { ok: false, message: 'Policy is invalid: a failed scan must always block.' }
  }
  return { ok: true, policy: parsed.policy }
}

/**
 * A stored policy is untrusted: it is re-validated, and anything invalid falls back to Strict. A stored preset
 * label is only kept if the rules still match it, so storage can't show "Strict" over other rules.
 */
function loadSaved(): Saved {
  const raw = readJson(STORAGE_KEYS.policy)
  if (typeof raw !== 'object' || raw === null) return DEFAULT
  const result = validate((raw as Record<string, unknown>).policy)
  return result.ok && result.policy ? { preset: detectPreset(result.policy), policy: result.policy } : DEFAULT
}

export function PolicyProvider({ children }: { children: ReactNode }): ReactElement {
  const [saved, setSaved] = useState<Saved>(loadSaved)

  const applyPolicy = useCallback((next: unknown, preset: PolicyPreset): ApplyPolicyResult => {
    const result = validate(next)
    if (!result.ok || !result.policy) return result.ok ? { ok: false, message: 'Policy is invalid.' } : result
    // A preset label must describe the rules; anything that no longer matches its preset is Custom.
    const value = { preset: preset === 'custom' ? preset : detectPreset(result.policy), policy: result.policy }
    setSaved(value)
    writeJson(STORAGE_KEYS.policy, value)
    return { ok: true }
  }, [])

  const resetPolicy = useCallback(() => {
    setSaved(DEFAULT)
    removeKey(STORAGE_KEYS.policy)
  }, [])

  const value = useMemo(
    () => ({ preset: saved.preset, policy: saved.policy, applyPolicy, resetPolicy }),
    [saved, applyPolicy, resetPolicy],
  )
  return <PolicyContext value={value}>{children}</PolicyContext>
}
