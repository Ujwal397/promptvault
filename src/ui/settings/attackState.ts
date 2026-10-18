import type { EvalReport } from '../../core'
import type { EvalCorpus } from '../../adapters/web/scanClient'
import type { RunInfo } from './attackView'

export type RunState =
  | { phase: 'idle' }
  | { phase: 'running'; corpus: EvalCorpus; info: RunInfo }
  | { phase: 'done'; corpus: EvalCorpus; info: RunInfo; report: EvalReport }
  | { phase: 'failed'; corpus: EvalCorpus; message: string }

export interface AttackState {
  /** The corpus the next run will use. Changing it does not clear the last run's results. */
  corpus: EvalCorpus
  run: RunState
}

export type AttackAction =
  | { type: 'select'; corpus: EvalCorpus }
  | { type: 'start'; info: RunInfo }
  | { type: 'succeed'; report: EvalReport }
  | { type: 'fail'; error: unknown }

export const INITIAL_ATTACK_STATE: AttackState = { corpus: 'regression', run: { phase: 'idle' } }

/** Only a message from our own error class reaches the screen. Anything else gets a generic line. */
export function failureMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'The attack suite did not complete.'
}

/**
 * A run moves idle or old results to running, then to done or failed. Results are only ever stored
 * from a run that is in progress, so no number appears without a measured report behind it.
 */
export function attackReducer(state: AttackState, action: AttackAction): AttackState {
  switch (action.type) {
    case 'select':
      return { ...state, corpus: action.corpus }
    case 'start':
      return { ...state, run: { phase: 'running', corpus: state.corpus, info: action.info } }
    case 'succeed':
      if (state.run.phase !== 'running') return state
      return {
        ...state,
        run: { phase: 'done', corpus: state.run.corpus, info: state.run.info, report: action.report },
      }
    case 'fail':
      if (state.run.phase !== 'running') return state
      return { ...state, run: { phase: 'failed', corpus: state.run.corpus, message: failureMessage(action.error) } }
  }
}
