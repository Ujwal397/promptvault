import { CustomRuleSchema, type CustomRule } from '../../core'
import { regexProblem } from './regexRules'

export const CUSTOM_RULE_LIMIT = 50

/** Shown under the regex field. Same rule as the core: bounded repeats only (see regexRules.ts). */
export const REGEX_RULE_HELP =
  "Patterns can't use * or + (or open ranges like {2,}), because unbounded repeats can make scans very slow. Use a bounded range such as {1,20} instead. Groups with quantifiers, lookarounds and backreferences are not allowed either."

export const PLACEHOLDER_HELP = 'Capital letters, digits and underscores, starting with a letter (up to 25).'

export interface CustomRuleInput {
  name: string
  kind: CustomRule['kind']
  pattern: string
  placeholderType: string
}

export type CustomRuleField = 'name' | 'pattern' | 'placeholderType' | 'form'
export type CustomRuleErrors = Partial<Record<CustomRuleField, string>>
export type CustomRuleCheck = { ok: true; rule: CustomRule } | { ok: false; errors: CustomRuleErrors }

const FIELD_MESSAGES: Record<Exclude<CustomRuleField, 'form'>, string> = {
  name: 'Give the rule a name of 1 to 60 characters.',
  pattern: 'Enter a keyword or pattern of 1 to 200 characters.',
  placeholderType: `Placeholder type: ${PLACEHOLDER_HELP}`,
}

/**
 * Validates a new custom rule against the CustomRule schema, then applies the regex gate. Matching is
 * case-insensitive and severity is Medium, because the form does not expose either setting.
 */
export function checkCustomRule(input: CustomRuleInput, id: string, existingCount: number): CustomRuleCheck {
  if (existingCount >= CUSTOM_RULE_LIMIT) {
    return { ok: false, errors: { form: `You can have up to ${CUSTOM_RULE_LIMIT} custom rules.` } }
  }
  const parsed = CustomRuleSchema.safeParse({
    id,
    name: input.name.trim(),
    kind: input.kind,
    pattern: input.pattern.trim(),
    caseSensitive: false,
    severity: 'medium',
    placeholderType: input.placeholderType.trim(),
    enabled: true,
  })
  if (!parsed.success) return { ok: false, errors: schemaErrors(parsed.error.issues) }
  const rule = parsed.data
  const problem = rule.kind === 'regex' ? regexProblem(rule.pattern) : null
  return problem ? { ok: false, errors: { pattern: problem } } : { ok: true, rule }
}

function schemaErrors(issues: readonly { path: readonly PropertyKey[] }[]): CustomRuleErrors {
  const errors: CustomRuleErrors = {}
  for (const issue of issues) {
    const head = issue.path[0]
    if (head === 'name') errors.name = FIELD_MESSAGES.name
    else if (head === 'pattern') errors.pattern = FIELD_MESSAGES.pattern
    else if (head === 'placeholderType') errors.placeholderType = FIELD_MESSAGES.placeholderType
    else errors.form = 'Could not save this rule. Check the fields and try again.'
  }
  return errors
}

const MAX_ID_ATTEMPTS = 8

/** A fresh id that matches the CustomRule id pattern and is not already taken. Null only if every attempt collides. */
export function newRuleId(taken: ReadonlySet<string>, randomHex: () => string = randomHex12): string | null {
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
    const id = `rule-${randomHex()}`
    if (!taken.has(id)) return id
  }
  return null
}

function randomHex12(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
