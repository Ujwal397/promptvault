import type { ReactElement } from 'react'

interface RecordToggleProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

/** Opt-in "Record activity" switch. A native button with role="switch", named by its visible label. */
export function RecordToggle({ checked, onCheckedChange }: RecordToggleProps): ReactElement {
  return (
    <div className="history-toggle">
      <span id="history-record-label" className="history-toggle__label">
        Record activity
      </span>
      {/* Keyed by its value, so On and Off fade into each other. */}
      <span key={checked ? 'on' : 'off'} className="history-toggle__state motion-fade">
        {checked ? 'On' : 'Off'}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby="history-record-label"
        className={checked ? 'history-toggle__track history-toggle__track--on' : 'history-toggle__track'}
        onClick={() => onCheckedChange(!checked)}
      >
        <span className="history-toggle__knob" aria-hidden="true" />
      </button>
    </div>
  )
}
