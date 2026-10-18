import { SEVERITY_SCORE, type Finding, type RiskBand, type ScanResult } from '../../core'

export type MeterTone = 'ember' | 'ochre' | 'stone'

export interface RiskSummary {
  /** "High risk", or "Risk not scored" when the scan produced no score. */
  title: string
  score: number | null
  tone: MeterTone
  /** A plain-language reason, or null when no known reason code applies. */
  reason: string | null
  /** Set when the policy blocks the prompt as it stands. */
  blockNote: string | null
}

const TITLES: Record<RiskBand, string> = {
  none: 'No risk',
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
  critical: 'Critical risk',
}

/** Plain-language phrases for finding reason codes. Codes without an entry are not described. */
const FINDING_REASONS = new Map<string, string>([
  ['CONNECTION_STRING_PASSWORD', 'Password inside a connection string'],
  ['URL_USERINFO_PASSWORD', 'Password inside a URL'],
  ['PASSWORD_ASSIGNMENT', 'Password assigned in text'],
  ['PROSE_PASSWORD', 'Password written in prose'],
  ['PROVIDER_PREFIX_EMBEDDED', 'Known provider key format'],
  ['AUTH_HEADER', 'Authorization header'],
  ['LUHN_VALID', 'Card number that passes the checksum'],
  ['HIGH_ENTROPY_UNLABELED', 'Random-looking string with no label'],
  ['LABEL_CONTEXT', 'Value next to a sensitive label'],
  ['NLP_PERSON', 'Name spotted in context'],
  ['NLP_PERSON_EMAIL', 'Name that also appears in an email'],
  ['EMAIL_FORMAT', 'Email address format'],
  ['INVISIBLE_CHARACTERS', 'Hidden characters in the text'],
  ['MIXED_SCRIPT', 'Look-alike characters from mixed scripts'],
  ['SPLIT_ACROSS_LINES', 'Value split across lines'],
  ['CLINICAL_CONTEXT', 'Clinical context'],
])

/** Policy-level reasons, most important first. */
const POLICY_REASONS = new Map<string, string>([
  ['SCAN_INCOMPLETE', 'Scan incomplete'],
  ['STRICT_CRITICAL_RISK', 'Critical risk in strict mode'],
  ['BELOW_MIN_CONFIDENCE', 'Some matches are uncertain'],
  ['NO_FINDINGS', 'Nothing sensitive found'],
])

const POLICY_ORDER = [...POLICY_REASONS.keys()]

export function bandTone(band: RiskBand | null): MeterTone {
  if (band === 'high' || band === 'critical') return 'ember'
  return band === 'medium' ? 'ochre' : 'stone'
}

function weight(finding: Finding): number {
  return SEVERITY_SCORE[finding.severity] * finding.confidence
}

/** The reason of the strongest real finding (obfuscation signals do not count). */
function strongestFindingReason(findings: readonly Finding[]): string | null {
  let best: Finding | null = null
  for (const finding of findings) {
    if (finding.category === 'obfuscation') continue
    if (best === null || weight(finding) > weight(best)) best = finding
  }
  return best ? (FINDING_REASONS.get(best.reasonCode) ?? null) : null
}

/** The single most useful reason for the risk line, drawn from the reason codes. */
export function topReason(scan: ScanResult): string | null {
  const fromFinding = strongestFindingReason(scan.findings)
  if (fromFinding) return fromFinding
  const code = POLICY_ORDER.find((c) => scan.reasonCodes.includes(c))
  return code === undefined ? null : (POLICY_REASONS.get(code) ?? null)
}

export function riskSummary(scan: ScanResult): RiskSummary {
  const scored = scan.riskBand !== null && scan.riskScore !== null
  return {
    title: scored && scan.riskBand !== null ? TITLES[scan.riskBand] : 'Risk not scored',
    score: scan.riskScore,
    tone: bandTone(scan.riskBand),
    reason: topReason(scan),
    blockNote: scan.policyDecision === 'block' ? 'Blocked by policy until these items are removed.' : null,
  }
}
