import type { ScanResult } from '../../core'

/** What the Write screen knows about its most recent scan request. */
export type ScanState =
  | { status: 'idle' }
  | { status: 'scanning' }
  | { status: 'done'; result: ScanResult }
  | { status: 'error' }

export type StatusTone = 'neutral' | 'warning' | 'danger'

export interface StatusLine {
  tone: StatusTone
  text: string
}

function countWord(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function riskPhrase(result: ScanResult): string {
  if (result.riskScore === null || result.riskBand === null) return 'risk not scored'
  return `risk ${result.riskBand} ${result.riskScore}`
}

function summary(result: ScanResult): string {
  const findings = countWord(result.findings.length, 'finding', 'findings')
  return `${findings}, ${riskPhrase(result)}, decision ${result.policyDecision}`
}

function describeResult(result: ScanResult): StatusLine | null {
  if (result.status === 'failed') {
    return {
      tone: 'danger',
      text: `Scan failed. This prompt was not checked, so it is not known to be clean. Decision: ${result.policyDecision}.`,
    }
  }
  if (result.status === 'partial') {
    return {
      tone: 'warning',
      text: `Scan incomplete: ${summary(result)}. Some checks did not finish, so this prompt is not fully checked.`,
    }
  }
  // A completed scan moves on to Review, so it gets no status line here.
  return null
}

/** Text for the status line under "Scan prompt". Failed or partial scans never read as clean. */
export function describeScan(state: ScanState): StatusLine | null {
  switch (state.status) {
    case 'idle':
      return null
    case 'scanning':
      return { tone: 'neutral', text: 'Scanning…' }
    case 'error':
      return { tone: 'danger', text: 'Scan could not run, so this prompt was not checked.' }
    case 'done':
      return describeResult(state.result)
  }
}
