/// <reference lib="webworker" />
// Test-only probe. Built exactly like the product scan worker (Vite ?worker&inline => blob: worker)
// and deliberately WITHOUT the lockdown module, so the CSP alone must stop network access.
type Outcome = 'blocked' | 'sent'
const ctx = self as unknown as DedicatedWorkerGlobalScope
const violations: Array<{ violatedDirective: string; blockedURI: string }> = []
ctx.addEventListener('securitypolicyviolation', (e) => {
  const v = e as SecurityPolicyViolationEvent
  violations.push({ violatedDirective: v.violatedDirective, blockedURI: v.blockedURI })
})

const probeFetch = (): Promise<Outcome> =>
  fetch('https://example.com/probe').then(
    (): Outcome => 'sent',
    (): Outcome => 'blocked',
  )

const probeWebSocket = (): Promise<Outcome> =>
  new Promise((resolve) => {
    try {
      const s = new WebSocket('wss://example.com/probe')
      s.onopen = () => resolve('sent')
      s.onerror = () => resolve('blocked')
      s.onclose = () => resolve('blocked')
    } catch {
      resolve('blocked')
    }
  })

ctx.addEventListener('message', () => {
  void Promise.all([probeFetch(), probeWebSocket()]).then(async ([fetchResult, wsResult]) => {
    await new Promise((r) => setTimeout(r, 100)) // let violation events dispatch
    ctx.postMessage({ fetch: fetchResult, websocket: wsResult, violations })
  })
})
