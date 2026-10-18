/**
 * Copies text with the async Clipboard API. Resolves false when the browser denies access or has no
 * clipboard, so the caller can say that nothing was copied. It never throws.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
