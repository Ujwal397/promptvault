import type { ReactElement } from 'react'

interface SegmentedProps<T extends string> {
  /** Accessible name for the group, for example "Placeholder style". */
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
}

/** Pill-shaped choice between a few options. Each button reports its state with aria-pressed. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: SegmentedProps<T>): ReactElement {
  return (
    <div role="group" aria-label={label} className="set-seg">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="set-seg__btn"
          aria-pressed={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
