/** Confidence for a label-backed value whose format matches but whose checksum / prefix validation fails. */
export const LABELED_FAILED_CONFIDENCE = 0.6
export const LABELED_FAILED_REASON = 'LABELED_FORMAT_CHECKSUM_FAILED'

/**
 * True if one of `labels` appears as a whole word (case-insensitive) in the `window` chars before `index`.
 * Stricter than `hasLabelBefore`: the label must also end at a non-letter, so "since" is not the label "sin".
 */
export function hasWholeLabelBefore(text: string, index: number, labels: readonly string[], window = 30): boolean {
  const seg = text.slice(Math.max(0, index - window), index).toLowerCase()
  for (const label of labels) {
    const needle = label.toLowerCase()
    let from = 0
    for (;;) {
      const at = seg.indexOf(needle, from)
      if (at < 0) break
      const before = at === 0 ? '' : seg[at - 1]
      const after = seg[at + needle.length] ?? ''
      if (!/\p{L}/u.test(before) && !/\p{L}/u.test(after)) return true
      from = at + 1
    }
  }
  return false
}
