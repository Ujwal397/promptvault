import type { ReactElement } from 'react'

interface RuleSwitchProps {
  checked: boolean
  /** Accessible name, for example "Enable Project codename". */
  ariaLabel: string
  onCheckedChange: (checked: boolean) => void
}

/**
 * Knob-only on/off switch for a single custom rule. The shared Switch in src/ui/components shows two text
 * labels, which does not fit a per-rule toggle, so this one stays inside the Policy folder.
 */
export function RuleSwitch({ checked, ariaLabel, onCheckedChange }: RuleSwitchProps): ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={checked ? 'rule-switch rule-switch--on' : 'rule-switch'}
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="rule-switch__knob" aria-hidden="true" />
    </button>
  )
}
