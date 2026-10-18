import type { ReactElement } from 'react'
import type { Finding, FindingDecision, Severity } from '../../core'
import { LockIcon } from './flowIcons'
import { needsAttention, isLocked } from './selection'

const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }
const TONE: Record<Severity, string> = { critical: 'high', high: 'high', medium: 'medium', low: 'low' }

interface FindingRowProps {
  finding: Finding
  /** Masked preview of the value. The full value is never shown here. */
  masked: string
  decision: FindingDecision | undefined
  checked: boolean
  disabled: boolean
  onToggle: (findingId: string) => void
}

/** Short tag before the confidence: why the row is in its current state. */
function tagFor(finding: Finding, decision: FindingDecision | undefined, checked: boolean): string | null {
  if (isLocked(decision)) return 'Always removed'
  if (finding.source === 'contextual') return 'Suggestion'
  if (!checked && needsAttention(decision)) return 'Kept by you'
  return null
}

/** One finding in the list: a checkbox, the label, severity, a masked value, and a short status line. */
export function FindingRow({ finding, masked, decision, checked, disabled, onToggle }: FindingRowProps): ReactElement {
  const locked = isLocked(decision)
  const tone = TONE[finding.severity]
  const confidence = `${Math.round(finding.confidence * 100)}% confidence`
  const tag = tagFor(finding, decision, checked)

  return (
    <label className="finding-row">
      <input
        type="checkbox"
        checked={checked}
        disabled={locked || disabled}
        onChange={() => onToggle(finding.findingId)}
      />
      <span className="finding-row__body">
        <span className="finding-row__head">
          <strong className="finding-row__label">{finding.label || finding.category}</strong>
          <span className={`severity severity--${tone}`}>
            <span className={`dot dot--${tone}`} aria-hidden="true" />
            {SEVERITY_LABEL[finding.severity]}
          </span>
        </span>
        <code className="finding-row__value">{masked}</code>
        <span className="finding-row__meta">
          {locked && <LockIcon className="finding-row__lock" />}
          {tag ? `${tag} · ${confidence}` : confidence}
        </span>
      </span>
    </label>
  )
}
