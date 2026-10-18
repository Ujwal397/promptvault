import { RETENTION_CHOICES } from '../state/contexts'

/** Shown for any measurement the engine could not produce. A missing value is never shown as zero. */
export const NOT_APPLICABLE = 'n/a'

/** Ratio (0 to 1) as a percentage with one decimal place. Values below 100% never display as "100%". */
export function formatPercent(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return NOT_APPLICABLE
  if (ratio > 0 && ratio < 0.0005) return '<0.1%'
  const tenths = Math.round(ratio * 1000) / 10
  if (tenths >= 100 && ratio < 1) return '99.9%'
  return `${tenths}%`
}

/** Milliseconds with two decimals, for example "1.10 ms". */
export function formatMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return NOT_APPLICABLE
  return `${ms.toFixed(2)} ms`
}

export function retentionLabel(days: number): string {
  return `${days} days`
}

/** The retention choices, plus the stored value when it is not one of them (so the select never lies). */
export function retentionOptions(current: number): number[] {
  const choices: readonly number[] = RETENTION_CHOICES
  if (choices.includes(current)) return [...choices]
  return [...choices, current].sort((a, b) => a - b)
}
