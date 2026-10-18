import type { PlaceholderMode } from '../../core'

export interface PlaceholderPreview {
  /** The label shown inside the redaction bar (no brackets). */
  bar: string
  /** The exact text the copied prompt contains. */
  copied: string
}

/**
 * What a redaction produces in each placeholder style. Mirrors src/core/redaction/placeholders.ts:
 * labelled mode writes `[TYPE_N]` (and only that mode can be restored), mask mode writes `[REDACTED_TYPE]`.
 * placeholderPreview.test.ts checks this against a real scan and sanitize.
 */
export function previewPlaceholder(mode: PlaceholderMode, type: string, n = 1): PlaceholderPreview {
  const label = mode === 'mask' ? `REDACTED_${type}` : `${type}_${n}`
  return { bar: label, copied: `[${label}]` }
}
