/** Fixed-length mask, so the hidden part does not reveal how long the value is. */
const MASK = '•••••'
const EMAIL = /^([A-Za-z0-9._%+-]{1,64})@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)$/

/**
 * Masked preview of a detected value for the findings list. It shows a short prefix and suffix and
 * never the whole value. Email addresses keep their domain, which is how the approved mockup reads.
 */
export function maskValue(value: string): string {
  const email = EMAIL.exec(value)
  if (email) {
    const local = Array.from(email[1] ?? '')
    const shown = local.length >= 6 ? 2 : local.length >= 4 ? 1 : 0
    return `${local.slice(0, shown).join('')}${MASK}@${email[2] ?? ''}`
  }
  const chars = Array.from(value)
  const n = chars.length
  if (n === 0) return ''
  const head = n < 4 ? 0 : n < 8 ? 1 : Math.min(4, Math.floor(n / 5))
  const tail = n < 12 ? 0 : Math.min(3, Math.floor(n / 8))
  return `${chars.slice(0, head).join('')}${MASK}${chars.slice(n - tail).join('')}`
}

/** Masked preview of the text a finding covers. */
export function maskSpan(text: string, span: { startOffset: number; endOffset: number }): string {
  return maskValue(text.slice(span.startOffset, span.endOffset))
}
