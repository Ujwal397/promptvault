import { useCallback, useReducer } from 'react'
import type { EvalCorpus } from '../../adapters/web/scanClient'
import { usePolicy, useScanClient } from '../state/contexts'
import { attackReducer, INITIAL_ATTACK_STATE, type RunState } from './attackState'

export interface AttackSuite {
  corpus: EvalCorpus
  run: RunState
  select: (corpus: EvalCorpus) => void
  start: () => Promise<void>
}

/** Runs the attack suite in the worker against the current policy. Results exist only for a finished run. */
export function useAttackSuite(): AttackSuite {
  const getClient = useScanClient()
  const { policy, preset } = usePolicy()
  const [state, dispatch] = useReducer(attackReducer, INITIAL_ATTACK_STATE)

  const select = useCallback((corpus: EvalCorpus) => dispatch({ type: 'select', corpus }), [])

  const start = useCallback(async () => {
    const corpus = state.corpus
    dispatch({ type: 'start', info: { policyName: policy.name, strict: preset === 'strict' } })
    try {
      const report = await getClient().evaluate({ policy, corpus })
      dispatch({ type: 'succeed', report })
    } catch (error) {
      dispatch({ type: 'fail', error })
    }
  }, [state.corpus, policy, preset, getClient])

  return { corpus: state.corpus, run: state.run, select, start }
}
