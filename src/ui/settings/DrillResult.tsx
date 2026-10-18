import type { ReactElement } from 'react'
import type { ScanResult } from '../../core'
import { countErrorCodes, interpretDrill } from './drill'
import type { DrillState } from './useFailureDrill'

/** The drill's real outcome. The verdict is worked out from the result, and every field is shown as returned. */
export function DrillResult({ state }: { state: DrillState }): ReactElement {
  if (state.phase === 'idle') return <p className="set-status">Not run yet.</p>
  if (state.phase === 'running') return <p role="status" className="set-status">Running the drill…</p>
  if (state.phase === 'error') {
    return (
      <p role="alert" className="set-status set-status--danger">
        The drill could not run, so nothing was verified.
      </p>
    )
  }
  return <DrillOutcome result={state.result} policyName={state.policyName} />
}

function DrillOutcome({
  result,
  policyName,
}: {
  result: ScanResult
  policyName: string
}): ReactElement {
  const verdict = interpretDrill(result)
  const codes = countErrorCodes(result.errors)
  return (
    <div className="set-results motion-rise">
      <p role="status" className={verdict.held ? 'set-verdict set-verdict--held' : 'set-verdict set-verdict--failed'}>
        {verdict.headline}
      </p>
      <p className="set-note">{verdict.detail}</p>
      <dl className="set-kv">
        <dt>Status</dt>
        <dd className="set-mono">{result.status}</dd>
        <dt>Decision</dt>
        <dd className="set-mono">{result.policyDecision}</dd>
        <dt>Findings reported</dt>
        <dd>{result.findings.length}</dd>
        <dt>Error codes</dt>
        <dd className="set-mono">
          {codes.length === 0 ? (
            'none'
          ) : (
            <ul className="set-codes">
              {codes.map((c) => (
                <li key={c.code}>{`${c.code} × ${c.count}`}</li>
              ))}
            </ul>
          )}
        </dd>
        <dt>Policy</dt>
        <dd>{policyName}</dd>
      </dl>
      <p className="set-note">
        A scan that did not complete is never a clean result, even when it reports no findings.
      </p>
    </div>
  )
}
