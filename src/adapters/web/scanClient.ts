import type { EngineError, EvalReport, Policy, SanitizeRequest, SanitizeResult, ScanRequest, ScanResult } from '../../core'
import { CORE_VERSION } from '../../core'
import ScanWorker from './scan.worker.ts?worker&inline'
import {
  EvalReportShape,
  extractId,
  parseResponse,
  SanitizeResultShape,
  ScanResultShape,
  type EvalCorpus,
} from './protocol'

export type { EvalCorpus } from './protocol'

export interface EvaluateRequest {
  policy: Policy
  corpus: EvalCorpus
}

export interface ScanClientOptions {
  timeoutMs?: number
  /** Hard timeout for an attack-suite run. Default 60 s. */
  evaluateTimeoutMs?: number
  workerFactory?: () => Worker
  /** Called (with no message content) when an untrusted message from the worker is dropped. */
  onInvalidMessage?: () => void
}

export interface ScanClient {
  scan(req: ScanRequest): Promise<ScanResult>
  sanitize(req: SanitizeRequest): Promise<SanitizeResult>
  /**
   * Runs the built-in attack suite inside the worker. Rejects on failure or timeout; there is no
   * fallback report, so the UI never shows numbers that were not measured.
   */
  evaluate(req: EvaluateRequest): Promise<EvalReport>
  dispose(): void
}

type FailCode = EngineError['code']
type CallKind = 'scan' | 'sanitize' | 'evaluate'

const RESULT_SHAPES = { scan: ScanResultShape, sanitize: SanitizeResultShape, evaluate: EvalReportShape }

class EvaluationFailedError extends Error {
  constructor(code: FailCode) {
    super(`Attack suite did not complete (${code}).`)
    this.name = 'EvaluationFailedError'
  }
}

interface Pending {
  kind: CallKind
  bound: (result: unknown) => boolean
  settle: (value: unknown) => void
  fail: (code: FailCode) => void
}

// Inline (blob:) worker: it inherits the document CSP (connect-src 'none'), which a URL-loaded worker would not.
const defaultFactory = (): Worker => new ScanWorker()

const INCONSISTENT_SCAN_ERRORS = new Set([
  'DETECTOR_FAILURE',
  'SCAN_TIMEOUT',
  'POLICY_INVALID',
  'INVALID_FINDING_RANGE',
  'FINDINGS_TRUNCATED',
])

const asRecord = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}

/** Result must belong to this request/policy and be internally consistent; otherwise fail closed. */
function scanResultBound(result: unknown, req: ScanRequest): boolean {
  const r = asRecord(result)
  if (r.requestId !== req.requestId || r.policyId !== req.policy.policyId) return false
  if (r.status === 'completed') {
    if (r.riskScore === null || r.riskScore === undefined) return false
    const errors = Array.isArray(r.errors) ? r.errors : []
    if (errors.some((e) => INCONSISTENT_SCAN_ERRORS.has(String(asRecord(e).code)))) return false
  }
  return true
}

function sanitizeResultBound(result: unknown): boolean {
  const r = asRecord(result)
  if (r.validationPassed !== true) return true
  const residual = r.residualFindingIds
  return asRecord(r.postScan).status === 'completed' && Array.isArray(residual) && residual.length === 0
}

const failedScan = (req: ScanRequest, code: FailCode): ScanResult => ({
  requestId: req.requestId,
  status: 'failed',
  findings: [],
  riskScore: null,
  riskBand: null,
  policyDecision: req.policy.onScanFailure,
  findingDecisions: [],
  reasonCodes: ['SCAN_INCOMPLETE', code],
  mandatoryRulesTriggered: [],
  detectorVersions: {},
  errors: [{ code, message: 'Scan did not complete; treated as failed.' }],
  durationMs: 0,
  policyId: req.policy.policyId,
  policyVersion: req.policy.policyVersion,
  coreVersion: CORE_VERSION,
})

const failedSanitize = (): SanitizeResult => ({
  status: 'failed',
  sanitizedText: null,
  replacements: [],
  residualFindingIds: [],
  postScan: null,
  validationPassed: false,
  residualRiskNotes: ['Sanitization did not complete; output is not validated.'],
  errors: [{ code: 'POST_SCAN_FAILED', message: 'Sanitization did not complete; output not validated.' }],
})

export function createScanClient(opts: ScanClientOptions = {}): ScanClient {
  const timeoutMs = opts.timeoutMs ?? 5000
  const factory = opts.workerFactory ?? defaultFactory
  const pending = new Map<string, Pending>()
  let worker: Worker | null = null
  let disposed = false

  function failAll(code: FailCode): void {
    for (const p of [...pending.values()]) p.fail(code)
  }

  function killWorker(): void {
    const w = worker
    worker = null
    if (w) {
      try {
        w.terminate()
      } catch {
        /* already gone */
      }
    }
  }

  function getWorker(): Worker {
    if (worker) return worker
    const w = factory()
    w.addEventListener('message', (e) => {
      if (worker === w) onMessage(e as MessageEvent<unknown>)
    })
    const crash = () => {
      if (worker !== w) return
      killWorker()
      failAll('DETECTOR_FAILURE')
    }
    w.addEventListener('error', crash)
    w.addEventListener('messageerror', crash)
    worker = w
    return w
  }

  function onMessage(e: MessageEvent<unknown>): void {
    const res = parseResponse(e.data)
    if (!res) {
      opts.onInvalidMessage?.()
      const id = extractId(e.data)
      if (id) pending.get(id)?.fail('DETECTOR_FAILURE')
      return
    }
    const p = pending.get(res.id)
    if (!p) return
    if (!res.ok) return p.fail('DETECTOR_FAILURE')
    if (!RESULT_SHAPES[p.kind].safeParse(res.result).success || !p.bound(res.result)) {
      opts.onInvalidMessage?.()
      return p.fail('DETECTOR_FAILURE')
    }
    p.settle(res.result)
  }

  function call<T>(
    kind: CallKind,
    payload: unknown,
    bound: (result: unknown) => boolean,
    failedValue: (code: FailCode) => T,
    limitMs = timeoutMs,
  ): Promise<T> {
    if (disposed) return Promise.resolve(failedValue('DETECTOR_FAILURE'))
    return new Promise<T>((resolve) => {
      const id = crypto.randomUUID()
      let timer: ReturnType<typeof setTimeout> | undefined
      const done = (value: T) => {
        if (!pending.delete(id)) return
        clearTimeout(timer)
        resolve(value)
      }
      timer = setTimeout(() => {
        // Hard backstop: kill the worker (runaway regex) and fail every in-flight call closed.
        killWorker()
        failAll('SCAN_TIMEOUT')
      }, limitMs)
      pending.set(id, { kind, bound, settle: (v) => done(v as T), fail: (code) => done(failedValue(code)) })
      try {
        getWorker().postMessage({ id, type: kind, payload })
      } catch {
        killWorker()
        pending.get(id)?.fail('DETECTOR_FAILURE')
      }
    })
  }

  return {
    scan: (req) => call<ScanResult>('scan', req, (r) => scanResultBound(r, req), (code) => failedScan(req, code)),
    sanitize: (req) => call<SanitizeResult>('sanitize', req, sanitizeResultBound, () => failedSanitize()),
    async evaluate(req) {
      const result = await call<EvalReport | FailCode>(
        'evaluate',
        req,
        () => true,
        (code) => code,
        opts.evaluateTimeoutMs ?? 60_000,
      )
      if (typeof result === 'string') throw new EvaluationFailedError(result)
      return result
    },
    dispose() {
      disposed = true
      failAll('DETECTOR_FAILURE')
      killWorker()
    },
  }
}
