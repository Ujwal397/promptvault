import type { ReactElement } from 'react'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Accessible name, for example "Strict mode". */
  ariaLabel: string
  /** Visible labels. The checked option is the first label, which keeps the approved Strict | Permissive order. */
  checkedText: string
  uncheckedText: string
}

/** Keyboard-operable on/off switch (a native button with role="switch"). */
export function Switch({
  checked,
  onCheckedChange,
  ariaLabel,
  checkedText,
  uncheckedText,
}: SwitchProps): ReactElement {
  const options = [
    { text: checkedText, active: checked },
    { text: uncheckedText, active: !checked },
  ]
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className="switch"
      onClick={() => onCheckedChange(!checked)}
    >
      {options.map((option) => (
        <span key={option.text} className={option.active ? 'switch__option switch__option--on' : 'switch__option'}>
          {option.text}
        </span>
      ))}
    </button>
  )
}
