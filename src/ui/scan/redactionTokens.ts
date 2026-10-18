/** A piece of the sanitized text: plain text, or a placeholder drawn as a redaction bar. */
export type SanitizedToken = { kind: 'text'; text: string } | { kind: 'bar'; placeholder: string; label: string }

interface Span {
  start: number
  end: number
  placeholder: string
}

/** `[EMAIL_1]` becomes `EMAIL_1`. The bar shows the label; the copied text keeps the brackets. */
export function barLabel(placeholder: string): string {
  return placeholder.startsWith('[') && placeholder.endsWith(']') ? placeholder.slice(1, -1) : placeholder
}

/**
 * Splits the sanitized text into plain runs and placeholder bars. The placeholder positions come from
 * the replacements (original offsets), not from a pattern match, so a literal `[EMAIL_1]` the user typed
 * stays plain text. If the replacements do not line up with the text, the whole text is shown as plain
 * text: the displayed output then always matches what gets copied.
 */
export function tokenizeSanitized(sanitizedText: string, replacements: readonly Span[]): SanitizedToken[] {
  const ordered = [...replacements].sort((a, b) => a.start - b.start)
  const tokens: SanitizedToken[] = []
  let cursor = 0
  let shift = 0
  for (const r of ordered) {
    const start = r.start + shift
    const end = start + r.placeholder.length
    const valid = r.start < r.end && start >= cursor && sanitizedText.slice(start, end) === r.placeholder
    if (!valid) return [{ kind: 'text', text: sanitizedText }]
    if (start > cursor) tokens.push({ kind: 'text', text: sanitizedText.slice(cursor, start) })
    tokens.push({ kind: 'bar', placeholder: r.placeholder, label: barLabel(r.placeholder) })
    cursor = end
    shift += r.placeholder.length - (r.end - r.start)
  }
  if (cursor < sanitizedText.length) tokens.push({ kind: 'text', text: sanitizedText.slice(cursor) })
  return tokens
}
