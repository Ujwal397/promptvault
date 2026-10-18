/** Runs the synthetic corpus through the real engine (scan → policy → redact all actionable → post-scan). */
import { sanitize, scan } from '../engine'
import { STRICT_POLICY } from '../policy/presets'
import type { Policy, ScanResult } from '../types'
import { EVAL_CORPUS, type EvalCase } from './corpus'
import { runEvaluation, type EvalReport } from './runEval'

/** Note: `expectedDecision` in the corpus is defined for STRICT_POLICY; other policies only make detection metrics comparable. */
export function evaluateWithEngine(policy: Policy = STRICT_POLICY, cases: EvalCase[] = EVAL_CORPUS): EvalReport {
  return runEvaluation(cases, {
    scan: (text) => scan({ requestId: 'eval', text, policy }),
    sanitize: (text: string, res: ScanResult) =>
      sanitize({
        requestId: 'eval',
        sourceText: text,
        findings: res.findings,
        findingIds: res.findingDecisions.filter((d) => d.action !== 'allow').map((d) => d.findingId),
        placeholderMode: 'typed',
        policy,
      }),
  })
}
