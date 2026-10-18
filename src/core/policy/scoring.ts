import { SEVERITY_SCORE, type Category, type Finding, type RiskBand } from '../types'

export const SCORING_VERSION = '1.0.0'

const CREDENTIAL_TYPES: ReadonlySet<Category> = new Set<Category>([
  'credential',
  'cloud_credential',
  'private_key',
  'db_connection',
  'crypto_seed',
])
const BONUS_STEP = 5
const BONUS_CAP = 15

export function bandForScore(score: number): RiskBand {
  if (score <= 0) return 'none'
  if (score < 30) return 'low'
  if (score < 60) return 'medium'
  if (score < 85) return 'high'
  return 'critical'
}

/** R = min(100, round(max(S*C) + B)); obfuscation is excluded from the max. */
export function computeRisk(findings: Finding[]): { score: number; band: RiskBand } {
  if (findings.length === 0) return { score: 0, band: 'none' }
  const scoring = findings.filter((f) => f.category !== 'obfuscation')
  const base = scoring.reduce((m, f) => Math.max(m, SEVERITY_SCORE[f.severity] * f.confidence), 0)

  const credentialCount = scoring.filter((f) => CREDENTIAL_TYPES.has(f.category)).length
  let bonus = Math.max(0, credentialCount - 1) * BONUS_STEP
  if (scoring.some((f) => f.category === 'db_connection' && (f.sensitiveSubspans?.length ?? 0) > 0)) {
    bonus += BONUS_STEP
  }
  if (scoring.length > 0 && scoring.length < findings.length) bonus += BONUS_STEP
  bonus = Math.min(BONUS_CAP, bonus)

  const score = Math.min(100, Math.round(base + bonus))
  return { score, band: bandForScore(score) }
}
