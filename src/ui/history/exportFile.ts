import { utcDay } from './historyModel'

/** File name for an export, dated like the records (UTC). */
export function historyFileName(now: Date): string {
  return `promptvault-history-${utcDay(now)}.json`
}

// Some browsers still need the Blob URL for a moment after the click. This matches the FileSaver default.
const REVOKE_DELAY_MS = 40_000

/** Saves text as a .json download through a Blob URL, then revokes that URL. */
export function downloadJson(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}
