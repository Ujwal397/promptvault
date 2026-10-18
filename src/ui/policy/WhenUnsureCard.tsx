import type { ReactElement } from 'react'
import type { Policy, PolicyAction } from '../../core'
import { LockIcon } from './PolicyIcons'
import { ACTION_OPTIONS, LOW_CONFIDENCE_OPTIONS, toAction, toLowConfidenceAction, type LowConfidenceAction } from './rules'

interface WhenUnsureCardProps {
  policy: Policy
  onDefaultAction: (action: PolicyAction) => void
  onLowConfidenceAction: (action: LowConfidenceAction) => void
}

/**
 * Fallbacks for findings that have no rule or sit below their rule's confidence. Scan failure is shown
 * but locked to Block, and contextualAnalysis is not on this screen (Settings owns it).
 */
export function WhenUnsureCard({ policy, onDefaultAction, onLowConfidenceAction }: WhenUnsureCardProps): ReactElement {
  return (
    <section className="card policy-card policy-unsure" aria-labelledby="unsure-title">
      <h2 id="unsure-title" className="policy-card__title">
        When unsure
      </h2>

      <div className="field">
        <label htmlFor="default-action" className="field__label">
          Anything without a rule
        </label>
        <select
          id="default-action"
          className="policy-select"
          value={policy.defaultAction}
          onChange={(event) => {
            const action = toAction(event.currentTarget.value)
            if (action) onDefaultAction(action)
          }}
        >
          {ACTION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="low-confidence-action" className="field__label">
          Low-confidence matches
        </label>
        <select
          id="low-confidence-action"
          className="policy-select"
          value={policy.lowConfidenceAction}
          onChange={(event) => {
            const action = toLowConfidenceAction(event.currentTarget.value)
            if (action) onLowConfidenceAction(action)
          }}
        >
          {LOW_CONFIDENCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="lock-row">
        <div className="lock-row__text">
          <span className="lock-row__title">If a scan fails</span>
          <span className="lock-row__note">Always blocks. Never sends unchecked.</span>
        </div>
        <span className="lock-value">
          <LockIcon className="policy-icon" />
          Block
        </span>
      </div>
    </section>
  )
}
