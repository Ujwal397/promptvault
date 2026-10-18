import { describe, expect, it, vi } from 'vitest'
import { STRICT_POLICY, type ScanRequest, type SanitizeRequest } from '../../core'
import type { ScanSnapshot } from './scanFlowState'
import { makeDecision, makeFinding, makeScan, makeSanitize } from './scanFixtures'
import { REDACTION_FAILED, RESCAN_FAILED, SELECTION_STALE, runRedaction } from './runRedaction'
import { defaultSelection, decisionMap } from './selection'

// Synthetic prompt: f-0 is optional (redact), f-1 is mandatory, f-2 is allow.
const findings = [
  makeFinding({ findingId: 'f-0', startOffset: 0, endOffset: 5 }),
  makeFinding({ findingId: 'f-1', startOffset: 10, endOffset: 20, category: 'credential', label: 'API key' }),
  makeFinding({ findingId: 'f-2', startOffset: 30, endOffset: 36, category: 'ip_address', label: 'IP address' }),
]
const decisions = [
  makeDecision('f-0', 'redact'),
  makeDecision('f-1', 'redact', { mandatory: true }),
  makeDecision('f-2', 'allow'),
]
const snapshot: ScanSnapshot = {
  text: 'a@b.i aaaaaaaaaa sk-x bbbbbbbbbbbbbbbbbbbbbb',
  policy: STRICT_POLICY,
  result: makeScan({ findings, findingDecisions: decisions, riskBand: 'high', riskScore: 70, policyDecision: 'redact' }),
}

// What a re-scan with f-0 retained returns: same finding ids, f-0 now allowed.
const retainedRescan = makeScan({
  findings,
  findingDecisions: [
    makeDecision('f-0', 'allow', { reasonCode: 'USER_RETAINED', retained: true }),
    makeDecision('f-1', 'redact', { mandatory: true }),
    makeDecision('f-2', 'allow'),
  ],
})

function setup(options: { rescan?: ReturnType<typeof makeScan>; sanitize?: ReturnType<typeof makeSanitize> } = {}) {
  const scan = vi.fn((req: ScanRequest) => Promise.resolve({ ...(options.rescan ?? retainedRescan), requestId: req.requestId }))
  const sanitize = vi.fn((req: SanitizeRequest) => Promise.resolve(options.sanitize ?? makeSanitize({ sanitizedText: `out ${req.findingIds.length}` })))
  let n = 0
  const input = {
    snapshot,
    selected: defaultSelection(findings, decisionMap(decisions)),
    placeholderMode: 'typed' as const,
    newRequestId: () => `req-${++n}`,
  }
  return { client: { scan, sanitize }, scan, sanitize, input }
}

describe('runRedaction', () => {
  it('redacts the ticked findings with no re-scan when nothing is kept', async () => {
    const { client, scan, sanitize, input } = setup()
    const outcome = await runRedaction(client, input)
    expect(scan).not.toHaveBeenCalled()
    expect(sanitize).toHaveBeenCalledOnce()
    const request = sanitize.mock.calls[0]?.[0]
    expect(request).toMatchObject({
      sourceText: snapshot.text,
      findingIds: ['f-0', 'f-1'],
      placeholderMode: 'typed',
      structured: true,
      includeMapping: true,
    })
    expect(request?.options).toBeUndefined()
    expect(outcome).toMatchObject({ ok: true, output: { source: snapshot.text, kept: 0 } })
  })

  it('re-scans with the unticked findings as retained, and uses the re-scan for redaction', async () => {
    const rescan = makeScan({ findings, findingDecisions: [makeDecision('f-0', 'allow', { retained: true }), makeDecision('f-1', 'redact', { mandatory: true }), makeDecision('f-2', 'allow')] })
    const { client, scan, sanitize, input } = setup({ rescan })
    const outcome = await runRedaction(client, { ...input, selected: new Set(['f-1']) })
    expect(scan).toHaveBeenCalledOnce()
    expect(scan.mock.calls[0]?.[0].options).toEqual({ retainedFindingIds: ['f-0'] })
    const request = sanitize.mock.calls[0]?.[0]
    expect(request?.findings).toEqual(findings)
    expect(request?.findingIds).toEqual(['f-1'])
    expect(request?.options).toEqual({ retainedFindingIds: ['f-0'] })
    expect(outcome).toMatchObject({ ok: true, output: { kept: 1 } })
  })

  it('never retains a locked finding, even when the selection leaves it out', async () => {
    const { client, scan, sanitize, input } = setup()
    await runRedaction(client, { ...input, selected: new Set() })
    expect(scan.mock.calls[0]?.[0].options?.retainedFindingIds).toEqual(['f-0'])
    expect(sanitize.mock.calls[0]?.[0].findingIds).toEqual(['f-1'])
  })

  it('redacts an allow-decision finding the user chose to tick', async () => {
    const { client, sanitize, input } = setup()
    await runRedaction(client, { ...input, selected: new Set(['f-0', 'f-1', 'f-2']) })
    expect(sanitize.mock.calls[0]?.[0].findingIds).toEqual(['f-0', 'f-1', 'f-2'])
  })

  it('does not sanitize when the re-scan did not finish', async () => {
    const { client, sanitize, input } = setup({ rescan: makeScan({ status: 'partial', riskScore: null, riskBand: null }) })
    const outcome = await runRedaction(client, { ...input, selected: new Set(['f-1']) })
    expect(sanitize).not.toHaveBeenCalled()
    expect(outcome).toEqual({ ok: false, message: RESCAN_FAILED })
  })

  it('refuses a selection that names a finding the scan does not have', async () => {
    const { client, sanitize, input } = setup()
    const outcome = await runRedaction(client, { ...input, selected: new Set(['f-0', 'f-99']) })
    expect(sanitize).not.toHaveBeenCalled()
    expect(outcome).toEqual({ ok: false, message: SELECTION_STALE })
  })

  it('reports a rejected redaction and never returns output', async () => {
    const { client, input } = setup({ sanitize: makeSanitize({ status: 'rejected', sanitizedText: null, validationPassed: false }) })
    const outcome = await runRedaction(client, input)
    expect(outcome).toEqual({ ok: false, message: REDACTION_FAILED })
  })

  it('returns a message, not an exception, when the client throws', async () => {
    const client = {
      scan: vi.fn(() => Promise.resolve(makeScan())),
      sanitize: vi.fn(() => Promise.reject(new Error('worker gone'))),
    }
    const { input } = setup()
    const outcome = await runRedaction(client, input)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.message).not.toContain('worker gone')
  })

  it('asks for the mapping in typed mode and passes the chosen placeholder mode through', async () => {
    const { client, sanitize, input } = setup()
    await runRedaction(client, { ...input, placeholderMode: 'mask' })
    expect(sanitize.mock.calls[0]?.[0]).toMatchObject({ placeholderMode: 'mask', includeMapping: true })
  })
})
