import type { PlaceholderMode } from '../types'

export interface PlaceholderFactory {
  /** Returns the placeholder for a (type, value) pair, consistent across calls. */
  get(type: string, value: string): string
}

/**
 * Typed mode: `[TYPE_N]`, same (type, value) -> same placeholder, N skips any
 * placeholder already present in the source text (anti-spoofing).
 * Mask mode: `[REDACTED_TYPE]`.
 */
export function createPlaceholderFactory(mode: PlaceholderMode, sourceText: string): PlaceholderFactory {
  const issued = new Map<string, string>()
  const counters = new Map<string, number>()

  return {
    get(type, value) {
      if (mode === 'mask') return `[REDACTED_${type}]`
      const key = `${type}\u0000${value}`
      const existing = issued.get(key)
      if (existing !== undefined) return existing
      let n = counters.get(type) ?? 0
      let candidate: string
      do {
        n += 1
        candidate = `[${type}_${n}]`
      } while (sourceText.includes(candidate))
      counters.set(type, n)
      issued.set(key, candidate)
      return candidate
    },
  }
}
