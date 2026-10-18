import { describe, expect, it } from 'vitest'
import { EVAL_CORPUS, STRICT_POLICY, evaluateWithEngine } from '../../core'
import { attackReducer, failureMessage, INITIAL_ATTACK_STATE, type AttackState } from './attackState'

const INFO = { policyName: 'Strict', strict: true }
const report = evaluateWithEngine(STRICT_POLICY, EVAL_CORPUS.slice(0, 2))

describe('attackReducer', () => {
  it('starts idle with no report, so nothing is shown before a run', () => {
    expect(INITIAL_ATTACK_STATE.run).toEqual({ phase: 'idle' })
  })

  it('keeps the selected corpus without touching results', () => {
    const next = attackReducer(INITIAL_ATTACK_STATE, { type: 'select', corpus: 'blind' })
    expect(next.corpus).toBe('blind')
    expect(next.run.phase).toBe('idle')
  })

  it('moves through running to done, storing the report and the run snapshot', () => {
    const started = attackReducer({ ...INITIAL_ATTACK_STATE, corpus: 'blind' }, { type: 'start', info: INFO })
    expect(started.run).toEqual({ phase: 'running', corpus: 'blind', info: INFO })

    const done = attackReducer(started, { type: 'succeed', report })
    expect(done.run).toEqual({ phase: 'done', corpus: 'blind', info: INFO, report })
  })

  it('shows an honest failure with no report when the run rejects', () => {
    const started = attackReducer(INITIAL_ATTACK_STATE, { type: 'start', info: INFO })
    const failed = attackReducer(started, { type: 'fail', error: new Error('Attack suite did not complete (SCAN_TIMEOUT).') })
    expect(failed.run).toEqual({
      phase: 'failed',
      corpus: 'regression',
      message: 'Attack suite did not complete (SCAN_TIMEOUT).',
    })
    expect('report' in failed.run).toBe(false)
  })

  it('ignores a late result that does not belong to a running run', () => {
    const idle: AttackState = INITIAL_ATTACK_STATE
    expect(attackReducer(idle, { type: 'succeed', report })).toBe(idle)
    expect(attackReducer(idle, { type: 'fail', error: new Error('late') })).toBe(idle)
  })

  it('hides the previous numbers while a new run is in progress', () => {
    const done = attackReducer(attackReducer(INITIAL_ATTACK_STATE, { type: 'start', info: INFO }), {
      type: 'succeed',
      report,
    })
    const restarted = attackReducer(done, { type: 'start', info: INFO })
    expect(restarted.run.phase).toBe('running')
    expect('report' in restarted.run).toBe(false)
  })
})

describe('failureMessage', () => {
  it('passes through the message of our own error', () => {
    expect(failureMessage(new Error('Attack suite did not complete (SCAN_TIMEOUT).'))).toBe(
      'Attack suite did not complete (SCAN_TIMEOUT).',
    )
  })

  it('uses a generic line for anything else', () => {
    expect(failureMessage('boom')).toBe('The attack suite did not complete.')
    expect(failureMessage(new Error(''))).toBe('The attack suite did not complete.')
  })
})
