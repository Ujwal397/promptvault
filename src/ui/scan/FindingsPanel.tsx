import { useState, type ReactElement } from 'react'
import type { Finding, Severity } from '../../core'
import { FindingRow } from './FindingRow'
import { maskSpan } from './masking'
import { isChecked, type DecisionMap } from './selection'
import './findings.css'

type Level = 'all' | 'high' | 'medium' | 'low'

const LEVELS: readonly { id: Level; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
]

function inLevel(level: Level, severity: Severity): boolean {
  if (level === 'all') return true
  if (level === 'high') return severity === 'high' || severity === 'critical'
  return severity === level
}

interface FindingsPanelProps {
  text: string
  findings: readonly Finding[]
  decisions: DecisionMap
  selected: ReadonlySet<string>
  disabled: boolean
  onToggle: (findingId: string) => void
}

/** Right column: the findings with checkboxes, filtered by severity. Filtering only hides rows; it never changes the selection. */
export function FindingsPanel({ text, findings, decisions, selected, disabled, onToggle }: FindingsPanelProps): ReactElement {
  const [level, setLevel] = useState<Level>('all')
  const visible = findings.filter((f) => inLevel(level, f.severity))

  return (
    <section className="card findings-card" aria-labelledby="findings-title">
      <div className="findings-head">
        <h2 id="findings-title" className="review-card-title">
          Findings
        </h2>
        <div role="group" aria-label="Filter by severity" className="pill-group">
          {LEVELS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="pill"
              aria-pressed={level === item.id}
              onClick={() => setLevel(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="findings-empty">
          {findings.length === 0 ? 'Nothing sensitive was found.' : 'No findings at this level.'}
        </p>
      ) : (
        <ul className="finding-list motion-stagger">
          {visible.map((finding) => (
            <li key={finding.findingId}>
              <FindingRow
                finding={finding}
                masked={maskSpan(text, finding)}
                decision={decisions.get(finding.findingId)}
                checked={isChecked(finding.findingId, decisions, selected)}
                disabled={disabled}
                onToggle={onToggle}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
