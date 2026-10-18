/**
 * Guarded localStorage access. Only settings, the saved policy (including any custom rule terms the user
 * typed), the last accepted signed-policy sequence and count-only activity records are stored here; prompt
 * text, raw values and placeholder mappings never are. Storage may be missing or
 * throw (private mode, blocked site data), so every call falls back silently.
 */
export const STORAGE_KEYS = {
  policy: 'promptvault.policy.v1',
  settings: 'promptvault.settings.v1',
  activity: 'promptvault.activity.v1',
  /** Highest accepted signed-policy sequence, so a rolled-back bundle stays rejected after a reload. */
  policySequence: 'promptvault.policy-sequence.v1',
} as const

export function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Not persisted; the in-memory state still applies for this session.
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Nothing to remove.
  }
}
