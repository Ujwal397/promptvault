import type { Category, PolicyAction, RiskBand } from '../../core'

/** Shown wherever a value is unknown (no risk band, not re-scanned), so an unknown never reads as zero. */
export const EMPTY_VALUE = '–'

export const DECISION_LABELS: Record<PolicyAction, string> = {
  allow: 'Allowed',
  warn: 'Warned',
  redact: 'Redacted',
  review: 'Needs review',
  block: 'Blocked',
}

export const RISK_LABELS: Record<RiskBand, string> = {
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

/** Plain names for the finding categories, as the user thinks of them. */
export const CATEGORY_LABELS: Record<Category, string> = {
  email: 'Email addresses',
  phone: 'Phone numbers',
  person_name: 'Names',
  ip_address: 'IP addresses',
  gov_id: 'Government IDs',
  financial: 'Bank & card numbers',
  health: 'Health information',
  credential: 'Passwords & API keys',
  cloud_credential: 'Cloud provider keys',
  private_key: 'Private keys',
  crypto_seed: 'Crypto seed phrases',
  db_connection: 'Database connections',
  custom: 'Custom rules',
  obfuscation: 'Hidden characters',
}

const DAY_LABEL = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/** A record's UTC day ('2026-10-18') as 'Oct 18'. Formatted in UTC because the bucket is UTC. */
export function formatDay(day: string): string {
  return DAY_LABEL.format(new Date(`${day}T00:00:00Z`))
}

/** The day of the month for the chart axis: '2026-10-05' gives '5'. */
export function formatDayNumber(day: string): string {
  return String(Number(day.slice(8)))
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-US')
}

/** A 0 to 1 share as a whole percentage, or the empty value when unknown. Rounding never shows 100% unless every record passed. */
export function formatRate(rate: number | null): string {
  if (rate === null) return EMPTY_VALUE
  if (rate >= 1) return '100%'
  return `${Math.min(99, Math.round(rate * 100))}%`
}

/** Re-scan column: passed, residuals found, or unknown when the prompt was never re-scanned. */
export function rescanLabel(validationPassed: boolean | null): string {
  if (validationPassed === null) return EMPTY_VALUE
  return validationPassed ? 'Passed' : 'Residuals found'
}
