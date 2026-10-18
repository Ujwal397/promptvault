import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STRICT_POLICY, type ScanResult } from '../../core'
import { createActivityStore } from './activityStore'

const scanResult = (): ScanResult =>
  ({
    requestId: 'r',
    status: 'completed',
    findings: [],
    riskScore: 0,
    riskBand: 'none',
    policyDecision: 'allow',
    findingDecisions: [],
    reasonCodes: [],
    mandatoryRulesTriggered: [],
    detectorVersions: {},
    errors: [],
    durationMs: 1,
    policyId: STRICT_POLICY.policyId,
    policyVersion: STRICT_POLICY.policyVersion,
    coreVersion: '1.0.0',
  }) as ScanResult

const count = (store: ReturnType<typeof createActivityStore>) => store.recorder().summary().total

describe('activity store', () => {
  const memory = new Map<string, string>()
  beforeEach(() => {
    memory.clear()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => memory.get(k) ?? null,
        setItem: (k: string, v: string) => void memory.set(k, v),
        removeItem: (k: string) => void memory.delete(k),
      },
    })
  })

  it('does not record while disabled (opt-in)', () => {
    const store = createActivityStore({ enabled: false, retentionDays: 30, records: [] })
    store.record(scanResult(), 'simulation')
    expect(count(store)).toBe(0)
  })

  it('a late record after opt-out is dropped (no stale snapshot)', () => {
    const store = createActivityStore({ enabled: true, retentionDays: 30, records: [] })
    const record = store.record // captured before the user turns recording off
    store.update((prev) => ({ ...prev, enabled: false }))
    record(scanResult(), 'simulation')
    expect(count(store)).toBe(0)
  })

  it('a late record after clear does not resurrect deleted history', () => {
    const store = createActivityStore({ enabled: true, retentionDays: 30, records: [] })
    store.record(scanResult(), 'simulation')
    store.record(scanResult(), 'simulation')
    const record = store.record
    store.update((prev) => ({ ...prev, records: [] }))
    record(scanResult(), 'simulation')
    expect(count(store)).toBe(1)
  })

  it('clear and disable in one handler both apply', () => {
    const store = createActivityStore({ enabled: true, retentionDays: 30, records: [] })
    store.record(scanResult(), 'simulation')
    store.update((prev) => ({ ...prev, records: [] }))
    store.update((prev) => ({ ...prev, enabled: false }))
    expect(store.get()).toMatchObject({ enabled: false, records: [] })
  })

  it('persists counts only, and notifies subscribers', () => {
    const store = createActivityStore({ enabled: true, retentionDays: 30, records: [] })
    let calls = 0
    store.subscribe(() => calls++)
    store.record(scanResult(), 'simulation')
    expect(calls).toBeGreaterThan(0)
    const saved = memory.get('promptvault.activity.v1') ?? ''
    expect(saved).toContain('"findingCount":0')
    expect(saved).not.toContain('requestId')
  })
})
