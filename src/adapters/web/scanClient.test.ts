import { describe, expect, it, vi } from 'vitest'
import { STRICT_POLICY, type SanitizeRequest, type ScanRequest } from '../../core'
import { createScanClient } from './scanClient'

class FakeWorker extends EventTarget {
  posted: Array<{ id: string; type: string; payload: unknown }> = []
  terminated = false
  postMessage(msg: { id: string; type: string; payload: unknown }): void {
    this.posted.push(msg)
  }
  terminate(): void {
    this.terminated = true
  }
  emit(data: unknown): void {
    this.dispatchEvent(Object.assign(new Event('message'), { data }))
  }
  crash(): void {
    this.dispatchEvent(new Event('error'))
  }
}

const scanReq = (requestId: string): ScanRequest => ({ requestId, text: 'hello', policy: STRICT_POLICY })
const sanitizeReq: SanitizeRequest = {
  requestId: 's1',
  sourceText: 'hello',
  findings: [],
  findingIds: [],
  placeholderMode: 'typed',
  policy: STRICT_POLICY,
}

const okScan = (requestId: string, over: Record<string, unknown> = {}) => ({
  requestId,
  policyId: STRICT_POLICY.policyId,
  riskScore: 0,
  status: 'completed',
  findings: [],
  policyDecision: 'allow',
  errors: [],
  ...over,
})

function setup(timeoutMs = 5000) {
  const workers: FakeWorker[] = []
  const onInvalidMessage = vi.fn()
  const client = createScanClient({
    timeoutMs,
    onInvalidMessage,
    workerFactory: () => {
      const w = new FakeWorker()
      workers.push(w)
      return w as unknown as Worker
    },
  })
  return { client, workers, onInvalidMessage }
}

describe('scanClient', () => {
  it('correlates concurrent requests by id (out of order)', async () => {
    const { client, workers } = setup()
    const a = client.scan(scanReq('A'))
    const b = client.scan(scanReq('B'))
    const w = workers[0]!
    expect(w.posted).toHaveLength(2)
    w.emit({ id: w.posted[1]!.id, ok: true, result: okScan('B') })
    w.emit({ id: w.posted[0]!.id, ok: true, result: okScan('A') })
    expect((await a).requestId).toBe('A')
    expect((await b).requestId).toBe('B')
  })

  it('sanitize round trip', async () => {
    const { client, workers } = setup()
    const p = client.sanitize(sanitizeReq)
    const w = workers[0]!
    w.emit({
      id: w.posted[0]!.id,
      ok: true,
      result: { status: 'completed', validationPassed: true, errors: [], sanitizedText: 'hello', residualFindingIds: [], postScan: { status: 'completed' } },
    })
    expect((await p).validationPassed).toBe(true)
  })

  it('fails closed on an invalid response for a pending id, and reports it', async () => {
    const { client, workers, onInvalidMessage } = setup()
    const p = client.scan(scanReq('A'))
    const w = workers[0]!
    w.emit({ id: w.posted[0]!.id, ok: 'yes', result: 1 })
    const r = await p
    expect(r.status).toBe('failed')
    expect(r.riskScore).toBeNull()
    expect(onInvalidMessage).toHaveBeenCalled()
  })

  it('fails closed when result shape is invalid', async () => {
    const { client, workers } = setup()
    const p = client.scan(scanReq('A'))
    const w = workers[0]!
    w.emit({ id: w.posted[0]!.id, ok: true, result: { status: 'completed' } })
    expect((await p).status).toBe('failed')
  })

  it('drops uncorrelatable garbage without affecting pending calls', async () => {
    const { client, workers, onInvalidMessage } = setup()
    const p = client.scan(scanReq('A'))
    const w = workers[0]!
    w.emit('garbage')
    w.emit(null)
    expect(onInvalidMessage).toHaveBeenCalledTimes(2)
    w.emit({ id: w.posted[0]!.id, ok: true, result: okScan('A') })
    expect((await p).status).toBe('completed')
  })

  it('timeout terminates the worker, fails closed, and recovers on next call', async () => {
    vi.useFakeTimers()
    try {
      const { client, workers } = setup(100)
      const p = client.scan(scanReq('A'))
      vi.advanceTimersByTime(101)
      const r = await p
      expect(workers[0]!.terminated).toBe(true)
      expect(r.status).toBe('failed')
      expect(r.riskScore).toBeNull()
      expect(r.policyDecision).toBe(STRICT_POLICY.onScanFailure)
      expect(r.errors[0]!.code).toBe('SCAN_TIMEOUT')

      const q = client.scan(scanReq('B'))
      expect(workers).toHaveLength(2)
      const w2 = workers[1]!
      w2.emit({ id: w2.posted[0]!.id, ok: true, result: okScan('B') })
      expect((await q).status).toBe('completed')

      const s = client.sanitize(sanitizeReq)
      vi.advanceTimersByTime(101)
      const sr = await s
      expect(sr.status).toBe('failed')
      expect(sr.validationPassed).toBe(false)
      expect(sr.errors[0]!.code).toBe('POST_SCAN_FAILED')
    } finally {
      vi.useRealTimers()
    }
  })

  it('worker crash fails closed and next call uses a fresh worker', async () => {
    const { client, workers } = setup()
    const p = client.scan(scanReq('A'))
    workers[0]!.crash()
    const r = await p
    expect(r.status).toBe('failed')
    expect(workers[0]!.terminated).toBe(true)
    const q = client.scan(scanReq('B'))
    expect(workers).toHaveLength(2)
    workers[1]!.emit({ id: workers[1]!.posted[0]!.id, ok: true, result: okScan('B') })
    expect((await q).status).toBe('completed')
  })

  it('worker-reported error fails closed; dispose fails further calls', async () => {
    const { client, workers } = setup()
    const p = client.scan(scanReq('A'))
    const w = workers[0]!
    w.emit({ id: w.posted[0]!.id, ok: false, error: { code: 'WORKER_ERROR', message: 'x' } })
    expect((await p).status).toBe('failed')
    client.dispose()
    expect((await client.scan(scanReq('C'))).status).toBe('failed')
  })

  it('uses unguessable uuid message ids', () => {
    const { client, workers } = setup()
    void client.scan(scanReq('A'))
    expect(workers[0]!.posted[0]!.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  type Make = (id: string) => Record<string, unknown>
  const scanRejected: Array<[string, Make]> = [
    ['requestId mismatch', () => okScan('OTHER')],
    ['policyId mismatch', (id) => okScan(id, { policyId: 'evil' })],
    ['completed with null riskScore', (id) => okScan(id, { riskScore: null })],
    ...['DETECTOR_FAILURE', 'SCAN_TIMEOUT', 'POLICY_INVALID', 'INVALID_FINDING_RANGE', 'FINDINGS_TRUNCATED'].map(
      (code): [string, Make] => ["completed with " + code, (id) => okScan(id, { errors: [{ code, message: 'x' }] })],
    ),
  ]
  for (const [name, make] of scanRejected) {
    it(`fails closed on scan result: ${name}`, async () => {
      const { client, workers, onInvalidMessage } = setup()
      const p = client.scan(scanReq('A'))
      const w = workers[0]!
      w.emit({ id: w.posted[0]!.id, ok: true, result: make('A') })
      const r = await p
      expect(r.status).toBe('failed')
      expect(r.riskScore).toBeNull()
      expect(onInvalidMessage).toHaveBeenCalled()
    })
  }

  const sanitizeOk = {
    status: 'completed',
    validationPassed: true,
    errors: [],
    sanitizedText: 'h',
    residualFindingIds: [],
    postScan: { status: 'completed' },
  }
  const sanitizeRejected: Array<[string, Record<string, unknown>]> = [
    ['postScan not completed', { ...sanitizeOk, postScan: { status: 'partial' } }],
    ['postScan missing', { ...sanitizeOk, postScan: null }],
    ['residual findings present', { ...sanitizeOk, residualFindingIds: ['f1'] }],
  ]
  for (const [name, result] of sanitizeRejected) {
    it(`fails closed on sanitize result: ${name}`, async () => {
      const { client, workers } = setup()
      const p = client.sanitize(sanitizeReq)
      const w = workers[0]!
      w.emit({ id: w.posted[0]!.id, ok: true, result })
      const r = await p
      expect(r.status).toBe('failed')
      expect(r.validationPassed).toBe(false)
    })
  }

  it('accepts a consistent validated sanitize result', async () => {
    const { client, workers } = setup()
    const p = client.sanitize(sanitizeReq)
    const w = workers[0]!
    w.emit({ id: w.posted[0]!.id, ok: true, result: sanitizeOk })
    expect((await p).validationPassed).toBe(true)
  })
})

const okReport = {
  corpusVersion: '1.0.0',
  totals: { cases: 1, precision: 1, recall: 1 },
  perCategory: { email: { precision: 1, recall: 1 } },
  falseBlockRate: 0,
  latency: { p50: 1, p95: 1, max: 1 },
  cases: [{ id: 'c1', decisionCorrect: true }],
}

describe('scanClient.evaluate', () => {
  it('posts the corpus choice and resolves with a well-formed report', async () => {
    const { client, workers } = setup()
    const p = client.evaluate({ policy: STRICT_POLICY, corpus: 'blind' })
    const w = workers[0]!
    expect(w.posted[0]).toMatchObject({ type: 'evaluate', payload: { corpus: 'blind' } })
    w.emit({ id: w.posted[0]!.id, ok: true, result: okReport })
    expect((await p).totals.cases).toBe(1)
  })

  it('rejects instead of inventing numbers when the worker reports an error', async () => {
    const { client, workers } = setup()
    const p = client.evaluate({ policy: STRICT_POLICY, corpus: 'regression' })
    const w = workers[0]!
    w.emit({ id: w.posted[0]!.id, ok: false, error: { code: 'WORKER_ERROR', message: 'x' } })
    await expect(p).rejects.toThrow('Attack suite did not complete')
  })

  it('rejects a malformed report', async () => {
    const { client, workers, onInvalidMessage } = setup()
    const p = client.evaluate({ policy: STRICT_POLICY, corpus: 'regression' })
    const w = workers[0]!
    w.emit({ id: w.posted[0]!.id, ok: true, result: { ...okReport, totals: { cases: 1, precision: 7, recall: 1 } } })
    await expect(p).rejects.toThrow()
    expect(onInvalidMessage).toHaveBeenCalled()
  })

  it('rejects on timeout and kills the worker', async () => {
    vi.useFakeTimers()
    try {
      const workers: FakeWorker[] = []
      const client = createScanClient({
        evaluateTimeoutMs: 100,
        workerFactory: () => {
          const w = new FakeWorker()
          workers.push(w)
          return w as unknown as Worker
        },
      })
      const p = client.evaluate({ policy: STRICT_POLICY, corpus: 'regression' })
      const assertion = expect(p).rejects.toThrow('SCAN_TIMEOUT')
      await vi.advanceTimersByTimeAsync(101)
      await assertion
      expect(workers[0]!.terminated).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects after dispose', async () => {
    const { client } = setup()
    client.dispose()
    await expect(client.evaluate({ policy: STRICT_POLICY, corpus: 'regression' })).rejects.toThrow()
  })
})
