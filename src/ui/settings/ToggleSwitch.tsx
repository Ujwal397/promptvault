import type { ReactElement } from 'react'
import './toggle.css'

interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Accessible name, for example "Record activity". */
  label: string
}

/** On/off switch: a native button with role="switch" and aria-checked. Knob position shows the state. */
export function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps): ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={checked ? 'set-toggle set-toggle--on' : 'set-toggle'}
      onClick={() => onChange(!checked)}
    >
      <span className="set-toggle__knob" aria-hidden="true" />
    </button>
  )
}
