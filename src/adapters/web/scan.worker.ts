/// <reference lib="webworker" />
import './lockdown'
import '../../zodJitless'
import { EVAL_CORPUS, evaluateWithEngine, sanitize, scan, type SanitizeRequest, type ScanRequest } from '../../core'
import { BLIND_CORPUS } from '../../core/eval/blind/corpus'
import { extractId, parseRequest, type WorkerResponse } from './protocol'

const ctx = self as unknown as DedicatedWorkerGlobalScope

function reply(msg: WorkerResponse): void {
  ctx.postMessage(msg)
}

ctx.addEventListener('message', (e: MessageEvent<unknown>) => {
  const req = parseRequest(e.data)
  if (!req) {
    // Invalid message: drop it; report without echoing content.
    const id = extractId(e.data)
    if (id) reply({ id, ok: false, error: { code: 'INVALID_MESSAGE', message: 'Request failed validation.' } })
    return
  }
  try {
    if (req.type === 'ping') reply({ id: req.id, ok: true, result: 'pong' })
    else if (req.type === 'scan') reply({ id: req.id, ok: true, result: scan(req.payload as ScanRequest) })
    else if (req.type === 'evaluate') {
      const cases = req.payload.corpus === 'blind' ? BLIND_CORPUS : EVAL_CORPUS
      reply({ id: req.id, ok: true, result: evaluateWithEngine(req.payload.policy, cases) })
    } else reply({ id: req.id, ok: true, result: sanitize(req.payload as unknown as SanitizeRequest) })
  } catch {
    reply({ id: req.id, ok: false, error: { code: 'WORKER_ERROR', message: 'Worker failed to process the request.' } })
  }
})
