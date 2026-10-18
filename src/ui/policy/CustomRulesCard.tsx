import { useState, type ReactElement } from 'react'
import type { CustomRule } from '../../core'
import type { CustomRuleErrors, CustomRuleInput } from './customRules'
import { CustomRuleForm } from './CustomRuleForm'
import { PlusIcon } from './PolicyIcons'
import { RuleSwitch } from './RuleSwitch'

interface CustomRulesCardProps {
  rules: readonly CustomRule[]
  onAdd: (input: CustomRuleInput) => CustomRuleErrors | null
  onToggle: (id: string, enabled: boolean) => void
  onRemove: (id: string) => void
}

/** Keyword and regex rules for the user's own terms. Each rule has an enabled switch and a remove button. */
export function CustomRulesCard({ rules, onAdd, onToggle, onRemove }: CustomRulesCardProps): ReactElement {
  const [adding, setAdding] = useState(false)
  // Bumped on each open. The form remounts then, so it starts empty and takes focus every time.
  const [formRound, setFormRound] = useState(0)

  const toggleAdding = (): void => {
    if (!adding) setFormRound((round) => round + 1)
    setAdding(!adding)
  }

  return (
    <section className="card policy-card custom-card" aria-labelledby="custom-title">
      <div className="policy-card__head">
        <div className="custom-card__intro">
          <h2 id="custom-title" className="policy-card__title">
            Custom rules
          </h2>
          <p className="policy-card__lede">Catch your own internal terms, like project names or ID formats. Saved rules are stored in this browser.</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-compact"
          aria-expanded={adding}
          aria-controls={adding ? 'custom-rule-form' : undefined}
          onClick={toggleAdding}
        >
          <PlusIcon className="policy-icon" />
          Add rule
        </button>
      </div>

      {/* Stays mounted once opened, so closing can animate. Closed content is inert, so it can't take focus. */}
      <div className="collapse" data-open={adding} inert={!adding}>
        <div className="collapse__inner">
          {formRound > 0 && <CustomRuleForm key={formRound} onAdd={onAdd} onDone={() => setAdding(false)} />}
        </div>
      </div>

      {rules.length === 0 ? (
        <p className="custom-card__empty">No custom rules yet.</p>
      ) : (
        <ul className="custom-rules">
          {rules.map((rule) => (
            <li key={rule.id} className="custom-rule motion-rise">
              <div className="custom-rule__text">
                <span className="custom-rule__head">
                  <strong className="custom-rule__name">{rule.name}</strong>
                  <span className="policy-chip">{rule.kind === 'keyword' ? 'Keyword' : 'Pattern'}</span>
                </span>
                <code className="custom-rule__code">{rule.pattern}</code>
                <span className="custom-rule__meta">
                  Placeholder [{rule.placeholderType}_1]
                </span>
              </div>
              <div className="custom-rule__actions">
                <RuleSwitch
                  checked={rule.enabled}
                  ariaLabel={`Enable ${rule.name}`}
                  onCheckedChange={(enabled) => onToggle(rule.id, enabled)}
                />
                <button type="button" className="btn-text" aria-label={`Remove ${rule.name}`} onClick={() => onRemove(rule.id)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
