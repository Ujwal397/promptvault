import { restorePlaceholders, type Finding, type Replacement } from '../../core'

/** The core's restore result. Derived, because the core index does not re-export its type. */
export type RestoreResult = ReturnType<typeof restorePlaceholders>

export interface PlaceholderRow {
  /** Exactly as issued, for example `[EMAIL_1]`. */
  placeholder: string
  /** The category label. Never the value. */
  label: string
}

const FALLBACK_LABEL = 'Redacted value'

/**
 * One row per placeholder in the mapping, in the order they appear in the prompt. The label comes from
 * the finding that produced the placeholder. The value is never included.
 */
export function placeholderRows(
  mapping: Readonly<Record<string, string>>,
  replacements: readonly Pick<Replacement, 'findingId' | 'placeholder'>[],
  findings: readonly Pick<Finding, 'findingId' | 'label'>[],
): PlaceholderRow[] {
  const labelById = new Map(findings.map((f) => [f.findingId, f.label || FALLBACK_LABEL] as const))
  const labelByPlaceholder = new Map<string, string>()
  for (const r of replacements) {
    if (!labelByPlaceholder.has(r.placeholder)) {
      labelByPlaceholder.set(r.placeholder, labelById.get(r.findingId) ?? FALLBACK_LABEL)
    }
  }
  return Object.keys(mapping).map((placeholder) => ({
    placeholder,
    label: labelByPlaceholder.get(placeholder) ?? FALLBACK_LABEL,
  }))
}

/** Swaps issued placeholders back to their values. Only the mapping's own placeholders are restored. */
export function restoreReply(reply: string, mapping: Readonly<Record<string, string>>): RestoreResult {
  return restorePlaceholders(reply, mapping)
}

export function restoreSummary(result: RestoreResult): string {
  const n = result.restoredCount
  const unknown = result.unknownPlaceholders.length
  if (n === 0 && unknown === 0) return 'No placeholders were found in this reply.'
  const restored = n === 1 ? 'Restored 1 placeholder.' : `Restored ${n} placeholders.`
  if (unknown === 0) return restored
  const left = unknown === 1 ? '1 placeholder was not issued for this prompt and was left as it is.' : `${unknown} placeholders were not issued for this prompt and were left as they are.`
  return `${restored} ${left}`
}
