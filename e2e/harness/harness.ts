import { STRICT_POLICY } from '../../src/core'
import { createScanClient } from '../../src/adapters/web/scanClient'
import ProbeWorker from './probe.worker.ts?worker&inline'

export interface ProbeResult {
  fetch: 'blocked' | 'sent'
  websocket: 'blocked' | 'sent'
  violations: Array<{ violatedDirective: string; blockedURI: string }>
}

export interface HarnessResult {
  decision: string
  findings: number
  sanitizedText: string | null
  validationPassed: boolean
}

declare global {
  interface Window {
    runHarness: (text: string) => Promise<HarnessResult>
    harnessReady: boolean
    __violations: Array<{ violatedDirective: string; blockedURI: string }>
    __workerUrls: string[]
    runWorkerProbe: () => Promise<ProbeResult>
  }
}

// Record CSP violations seen by the document.
window.__violations = []
document.addEventListener('securitypolicyviolation', (e) => {
  window.__violations.push({ violatedDirective: e.violatedDirective, blockedURI: e.blockedURI })
})

// Record every Worker constructor URL BEFORE the client (or probe) creates a worker.
window.__workerUrls = []
const NativeWorker = window.Worker
window.Worker = class extends NativeWorker {
  constructor(url: string | URL, options?: WorkerOptions) {
    window.__workerUrls.push(String(url))
    super(url, options)
  }
}

window.runWorkerProbe = () =>
  new Promise<ProbeResult>((resolve, reject) => {
    const w = new ProbeWorker()
    const timer = setTimeout(() => reject(new Error('probe timeout')), 10_000)
    w.onmessage = (e: MessageEvent<ProbeResult>) => {
      clearTimeout(timer)
      w.terminate()
      resolve(e.data)
    }
    w.onerror = () => reject(new Error('probe error'))
    w.postMessage('go')
  })

const client = createScanClient()
let n = 0

window.runHarness = async (text: string): Promise<HarnessResult> => {
  const policy = STRICT_POLICY
  const scanned = await client.scan({ requestId: `h-scan-${++n}`, text, policy })
  const toRedact = scanned.findings
    .filter((f) => scanned.findingDecisions.find((d) => d.findingId === f.findingId)?.action !== 'allow')
    .map((f) => f.findingId)
  const sanitized = await client.sanitize({
    requestId: `h-san-${n}`,
    sourceText: text,
    findings: scanned.findings,
    findingIds: toRedact,
    placeholderMode: 'typed',
    policy,
  })
  return {
    decision: scanned.policyDecision,
    findings: scanned.findings.length,
    sanitizedText: sanitized.sanitizedText,
    validationPassed: sanitized.validationPassed,
  }
}
window.harnessReady = true
