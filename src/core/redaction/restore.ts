const PLACEHOLDER_RE = /\[[A-Z][A-Z0-9_]{0,40}_\d{1,4}\]/g

export interface RestoreResult {
  text: string
  restoredCount: number
  unknownPlaceholders: string[]
}

/**
 * Restores only placeholders present in `mapping`. Placeholder-looking tokens not in the
 * mapping are left untouched and reported. Single pass: restored values are never rescanned.
 */
export function restorePlaceholders(text: string, mapping: Record<string, string>): RestoreResult {
  let restoredCount = 0
  const unknown = new Set<string>()
  const out = text.replace(PLACEHOLDER_RE, (token) => {
    if (Object.prototype.hasOwnProperty.call(mapping, token)) {
      restoredCount += 1
      return mapping[token] as string
    }
    unknown.add(token)
    return token
  })
  return { text: out, restoredCount, unknownPlaceholders: [...unknown] }
}
