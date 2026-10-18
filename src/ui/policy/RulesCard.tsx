import type { ReactElement } from 'react'
import type { Category, Policy, PolicyAction, PolicyRule } from '../../core'
import { LockIcon } from './PolicyIcons'
import {
  ACTION_LABELS,
  actionOptionsFor,
  isLockedCategory,
  lockedReason,
  RULE_ROWS,
  toAction,
  type RuleRowSpec,
} from './rules'

interface RulesCardProps {
  policy: Policy
  onRuleAction: (category: Category, action: PolicyAction) => void
}

/** Category, action and minimum confidence for each rule. Safety-floor rows are locked and say why. */
export function RulesCard({ policy, onRuleAction }: RulesCardProps): ReactElement {
  return (
    <section className="card policy-card" aria-labelledby="rules-title">
      <div className="policy-card__head">
        <h2 id="rules-title" className="policy-card__title">
          Rules by category
        </h2>
        <p className="policy-card__hint">
          <LockIcon className="policy-icon" />
          Locked rules can&apos;t be relaxed
        </p>
      </div>
      <table className="rules-table">
        <caption className="sr-only">Rules by category: action and minimum confidence</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Action</th>
            <th scope="col">Min. confidence</th>
          </tr>
        </thead>
        <tbody>
          {RULE_ROWS.map((row) => (
            <RuleRow
              key={row.category}
              spec={row}
              rule={policy.rules.find((candidate) => candidate.category === row.category)}
              defaultAction={policy.defaultAction}
              onRuleAction={onRuleAction}
            />
          ))}
        </tbody>
      </table>
    </section>
  )
}

interface RuleRowProps {
  spec: RuleRowSpec
  rule: PolicyRule | undefined
  defaultAction: PolicyAction
  onRuleAction: (category: Category, action: PolicyAction) => void
}

function RuleRow({ spec, rule, defaultAction, onRuleAction }: RuleRowProps): ReactElement {
  const { category, label } = spec
  if (!rule) {
    // A signed policy may leave a category without a rule. The engine then uses the default action, so say that.
    return (
      <tr>
        <th scope="row">
          <span className="rule-name">{label}</span>
        </th>
        <td data-label="Action">
          <span className="rule-fallback">Default: {ACTION_LABELS[defaultAction]}</span>
        </td>
        <td data-label="Min. confidence">
          <span className="mono">n/a</span>
        </td>
      </tr>
    )
  }
  const locked = isLockedCategory(category)
  const reasonId = `rule-${category}-reason`
  return (
    <tr>
      <th scope="row">
        <span className="rule-name">{label}</span>
        {locked && (
          <span id={reasonId} className="rule-lock">
            <LockIcon className="policy-icon" />
            {lockedReason(rule.action)}
          </span>
        )}
      </th>
      <td data-label="Action">
        <select
          className="policy-select"
          aria-label={`Action for ${label}`}
          aria-describedby={locked ? reasonId : undefined}
          value={rule.action}
          disabled={locked}
          onChange={(event) => {
            const action = toAction(event.currentTarget.value)
            if (action) onRuleAction(category, action)
          }}
        >
          {actionOptionsFor(category, rule.action).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </td>
      <td data-label="Min. confidence">
        <span className="mono">{rule.minConfidence.toFixed(2)}</span>
      </td>
    </tr>
  )
}
