import type { ReactElement } from 'react'
import { buildAttackView, CORPUS_TITLES } from './attackView'
import { AttackReport } from './AttackReport'
import type { RunState } from './attackState'

/** The results area. Numbers appear only for a finished run; every other state says so in words. */
export function AttackResults({ run }: { run: RunState }): ReactElement {
  if (run.phase === 'done') {
    return <AttackReport view={buildAttackView(run.report, run.corpus, run.info)} />
  }
  return (
    <div className="set-results">
      {run.phase === 'idle' && <p className="set-status">Not run yet.</p>}
      {run.phase === 'running' && (
        <p role="status" className="set-status">
          Running the {CORPUS_TITLES[run.corpus].toLowerCase()}. Nothing is shown until it finishes.
        </p>
      )}
      {run.phase === 'failed' && (
        <>
          <p role="alert" className="set-status set-status--danger">
            The attack suite did not complete, so there are no results and nothing was measured.
          </p>
          <p className="set-note">Reason: {run.message}</p>
        </>
      )}
    </div>
  )
}
