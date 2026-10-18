import { useEffect, useReducer, useRef, type ReactElement } from 'react'
import { useActivity, usePolicy, useSettings } from '../state/contexts'
import { clearedSummary, clearReducer } from './clearFlow'
import { SettingsItem } from './SettingsItem'

/**
 * Clears what the app stores, after a confirm step. Recording is switched off in a second step, once the
 * activity clear has rendered (see clearFlow.ts). Afterwards the screen lists what was removed.
 */
export function ClearEverything(): ReactElement {
  const { resetPolicy } = usePolicy()
  const { resetSettings } = useSettings()
  const activity = useActivity()
  const [state, dispatch] = useReducer(clearReducer, { phase: 'idle' })
  const cancelRef = useRef<HTMLButtonElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (state.phase === 'clearing') {
      activity.setEnabled(false)
      dispatch({ type: 'recordingOff' })
    }
  }, [state.phase, activity])

  // Keyboard users land on the safe choice when asked, and on the summary once it is done.
  useEffect(() => {
    if (state.phase === 'confirming') cancelRef.current?.focus()
    if (state.phase === 'cleared') summaryRef.current?.focus()
  }, [state.phase])

  const confirm = (): void => {
    resetPolicy()
    resetSettings()
    activity.clear()
    dispatch({ type: 'confirm', recordsRemoved: activity.records.length })
  }

  const phase = state.phase
  const control =
    phase === 'confirming' ? (
      <div className="set-actions motion-fade">
        <button ref={cancelRef} type="button" className="btn set-btn-ghost" onClick={() => dispatch({ type: 'cancel' })}>
          Cancel
        </button>
        <button type="button" className="btn set-btn-ghost set-btn-danger" onClick={confirm}>
          Yes, clear everything
        </button>
      </div>
    ) : (
      <button
        type="button"
        className="btn set-btn-ghost set-btn-danger"
        disabled={phase === 'clearing'}
        onClick={() => dispatch({ type: 'ask' })}
      >
        {phase === 'clearing' ? 'Clearing…' : 'Clear everything'}
      </button>
    )

  const footer =
    phase === 'confirming' ? (
      <div className="motion-expand">
        <p className="set-note">This removes your saved policy, settings and activity records. It cannot be undone.</p>
      </div>
    ) : phase === 'cleared' ? (
      <div ref={summaryRef} tabIndex={-1} role="status" className="set-cleared motion-rise">
        <p className="set-status set-status--ok">Cleared. This is what was removed:</p>
        <ul className="set-notes">
          {clearedSummary(state.recordsRemoved).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    ) : undefined

  return (
    <SettingsItem
      title="Clear all data"
      description="Removes your saved policy, settings and activity records from this browser."
      control={control}
      footer={footer}
    />
  )
}
