/**
 * Release gate (PRD §13.4 / §14.1) on the frozen synthetic corpus. These numbers are claims about THIS corpus only,
 * not real-world coverage. A regression in any detector, policy or redaction path fails here.
 */
import { describe, expect, it } from 'vitest'
import { evaluateWithEngine } from './evaluateWithEngine'

const report = evaluateWithEngine()
const CREDENTIAL_FAMILIES = ['credential', 'cloud_credential', 'private_key', 'crypto_seed', 'db_connection'] as const

describe('engine evaluation gate (corpus v' + report.corpusVersion + ')', () => {
  it('every case completes without an unhandled failure', () => {
    expect(report.cases.filter((c) => c.scanStatus !== 'completed')).toEqual([])
  })

  it.each(CREDENTIAL_FAMILIES)('%s recall ≥ 95%%', (cat) => {
    const m = report.perCategory[cat]
    expect(m?.support).toBeGreaterThan(0)
    expect(m?.recall).toBeGreaterThanOrEqual(0.95)
  })

  it('reports every category separately (no single aggregate hides weak categories)', () => {
    for (const m of Object.values(report.perCategory)) expect(m.recall).toBeGreaterThanOrEqual(0.85)
  })

  it('never blocks or forces redaction on harmless negative cases', () => {
    expect(report.falseBlockRate).toBe(0)
  })

  it('policy decision accuracy ≥ 95%', () => {
    expect(report.policyAccuracy).toBeGreaterThanOrEqual(0.95)
  })

  it('redaction removes expected values and validates in ≥ 95% of cases', () => {
    expect(report.redactionSuccess).toBeGreaterThanOrEqual(0.95)
  })

  it('heldout split is evaluated', () => {
    expect(report.bySplit.heldout.cases).toBeGreaterThan(0)
    expect(report.bySplit.heldout.recall).toBeGreaterThanOrEqual(0.9)
  })
})
