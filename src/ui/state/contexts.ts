/**
 * Shared app state: context objects, their types and the hooks screens use. Providers live in the
 * *Provider.tsx files next to this one. Kept apart so those files export components only (fast refresh).
 */
import { createContext, useContext, type Context } from 'react'
import {
  PERMISSIVE_POLICY,
  STRICT_POLICY,
  type EventKind,
  type EventRecord,
  type EventSummary,
  type PlaceholderMode,
  type Policy,
  type SanitizeResult,
  type ScanResult,
} from '../../core'
import type { ScanClient } from '../../adapters/web/scanClient'

// ---------- Scan client ----------

export const ScanClientContext = createContext<(() => ScanClient) | null>(null)

// ---------- Policy ----------

export type PolicyPreset = 'strict' | 'permissive' | 'custom'

export type ApplyPolicyResult = { ok: true } | { ok: false; message: string }

export interface PolicyState {
  preset: PolicyPreset
  /** Always a policy that passed parsePolicy, so the safety floor holds. */
  policy: Policy
  /** Validates with parsePolicy, then applies and persists. An invalid policy is rejected, never half-applied. */
  applyPolicy: (next: unknown, preset: PolicyPreset) => ApplyPolicyResult
  /** Back to the Strict preset, and forgets any saved policy. */
  resetPolicy: () => void
}

export const PolicyContext = createContext<PolicyState | null>(null)

export function presetPolicy(preset: Exclude<PolicyPreset, 'custom'>): Policy {
  return preset === 'strict' ? STRICT_POLICY : PERMISSIVE_POLICY
}

// ---------- Settings ----------

export interface SettingsState {
  /** How redactions are written into the sanitized text: `[EMAIL_1]` (typed) or a mask. */
  placeholderMode: PlaceholderMode
  setPlaceholderMode: (mode: PlaceholderMode) => void
  resetSettings: () => void
}

export const SettingsContext = createContext<SettingsState | null>(null)

// ---------- Activity ----------

/**
 * Opt-in activity log (PRD FR-026/FR-028). Records hold counts and enums only, never prompt text,
 * values or ids. When `enabled` is false, record() is a no-op.
 */
export interface ActivityState {
  enabled: boolean
  retentionDays: number
  setEnabled: (enabled: boolean) => void
  setRetentionDays: (days: number) => void
  /** Validated, unexpired records, oldest first. */
  records: readonly EventRecord[]
  summary: EventSummary
  /** 'simulation' = a scan was run; 'submission' = the user copied a sanitized prompt to send. */
  record: (scan: ScanResult, kind: EventKind, sanitize?: SanitizeResult) => void
  exportJson: () => string
  clear: () => void
}

export const RETENTION_CHOICES = [7, 30, 90, 365] as const

export const ActivityContext = createContext<ActivityState | null>(null)

// ---------- Shell tint ----------

/** Background state tint (Vault design). Only the Scan flow sets it; other tabs are always neutral. */
export type ShellTint = 'neutral' | 'ember' | 'sage'

export const ShellTintContext = createContext<((tint: ShellTint) => void) | null>(null)

// ---------- Hooks ----------

function useRequired<T>(context: Context<T | null>, name: string): T {
  const value = useContext(context)
  if (value === null) throw new Error(`${name} must be used inside AppProviders`)
  return value
}

/** Stable getter for the shared worker-backed scan client. Never call the core on the main thread. */
export const useScanClient = (): (() => ScanClient) => useRequired(ScanClientContext, 'useScanClient')
export const usePolicy = (): PolicyState => useRequired(PolicyContext, 'usePolicy')
export const useSettings = (): SettingsState => useRequired(SettingsContext, 'useSettings')
export const useActivity = (): ActivityState => useRequired(ActivityContext, 'useActivity')
/** Sets the Scan tab's background tint. Derive it from riskBand / validationPassed, never hard-code it. */
export const useSetShellTint = (): ((tint: ShellTint) => void) => useRequired(ShellTintContext, 'useSetShellTint')
