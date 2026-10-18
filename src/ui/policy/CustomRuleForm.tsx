import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react'
import type { CustomRule } from '../../core'
import { PLACEHOLDER_HELP, REGEX_RULE_HELP, type CustomRuleErrors, type CustomRuleInput } from './customRules'

interface CustomRuleFormProps {
  /** Returns the field errors, or null once the rule has been added. */
  onAdd: (input: CustomRuleInput) => CustomRuleErrors | null
  onDone: () => void
}

/** Space-separated ids for aria-describedby, or undefined when none apply. */
function describedBy(...ids: (string | false)[]): string | undefined {
  return ids.filter((id): id is string => id !== false).join(' ') || undefined
}

/** Inline form for one new rule. Validation runs on submit, through the same schema the core uses. */
export function CustomRuleForm({ onAdd, onDone }: CustomRuleFormProps): ReactElement {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CustomRule['kind']>('keyword')
  const [pattern, setPattern] = useState('')
  const [placeholderType, setPlaceholderType] = useState('')
  const [errors, setErrors] = useState<CustomRuleErrors>({})
  const nameInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameInput.current?.focus()
  }, [])

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const result = onAdd({ name, kind, pattern, placeholderType })
    if (result) setErrors(result)
    else onDone()
  }

  const isRegex = kind === 'regex'
  return (
    <form id="custom-rule-form" className="custom-form" onSubmit={submit} noValidate>
      <div className="custom-form__grid">
        <div className="field">
          <label htmlFor="custom-name" className="field__label">
            Rule name
          </label>
          <input
            id="custom-name"
            ref={nameInput}
            className="field__input"
            value={name}
            required
            autoComplete="off"
            aria-invalid={errors.name !== undefined}
            aria-describedby={describedBy(errors.name !== undefined && 'custom-name-error')}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          {errors.name && (
            <p id="custom-name-error" className="field__error">
              {errors.name}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="custom-kind" className="field__label">
            Match type
          </label>
          <select
            id="custom-kind"
            className="policy-select"
            value={kind}
            onChange={(event) => setKind(event.currentTarget.value === 'regex' ? 'regex' : 'keyword')}
          >
            <option value="keyword">Keyword</option>
            <option value="regex">Pattern (regular expression)</option>
          </select>
        </div>

        <div className="field custom-form__wide">
          <label htmlFor="custom-pattern" className="field__label">
            {isRegex ? 'Regular expression' : 'Keyword'}
          </label>
          <input
            id="custom-pattern"
            className="field__input field__input--mono"
            value={pattern}
            required
            autoComplete="off"
            spellCheck={false}
            aria-invalid={errors.pattern !== undefined}
            aria-describedby={describedBy(isRegex && 'custom-pattern-help', errors.pattern !== undefined && 'custom-pattern-error')}
            onChange={(event) => setPattern(event.currentTarget.value)}
          />
          {isRegex && (
            <p id="custom-pattern-help" className="field__hint">
              {REGEX_RULE_HELP}
            </p>
          )}
          {errors.pattern && (
            <p id="custom-pattern-error" className="field__error">
              {errors.pattern}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="custom-placeholder" className="field__label">
            Placeholder type
          </label>
          <input
            id="custom-placeholder"
            className="field__input field__input--mono"
            value={placeholderType}
            required
            autoComplete="off"
            spellCheck={false}
            aria-invalid={errors.placeholderType !== undefined}
            aria-describedby={describedBy('custom-placeholder-help', errors.placeholderType !== undefined && 'custom-placeholder-error')}
            onChange={(event) => setPlaceholderType(event.currentTarget.value)}
          />
          <p id="custom-placeholder-help" className="field__hint">
            {PLACEHOLDER_HELP}
          </p>
          {errors.placeholderType && (
            <p id="custom-placeholder-error" className="field__error">
              {errors.placeholderType}
            </p>
          )}
        </div>
      </div>

      {errors.form && (
        <p role="alert" className="field__error">
          {errors.form}
        </p>
      )}

      <div className="custom-form__actions">
        <button type="button" className="btn btn-ghost btn-compact" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-compact">
          Add rule
        </button>
      </div>
    </form>
  )
}
