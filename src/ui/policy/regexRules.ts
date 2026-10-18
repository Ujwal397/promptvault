/**
 * Regex gate for custom rules. The verdict comes from the core (`customRegexProblem`), which runs exactly the
 * checks the scanner applies, so the form and the scanner can't drift. This module only rewords the reason.
 */
import { customRegexProblem } from '../../core'

const MESSAGES: ReadonlyArray<readonly [match: RegExp, message: string]> = [
  [/^backreferences/, 'Backreferences such as \\1 or \\k<name> are not allowed.'],
  [/^(lookarounds|lookbehind)/, 'Lookahead and lookbehind assertions are not allowed.'],
  [/^quantified groups/, 'Quantifiers on groups, such as (ab){1,3}, are not allowed. Repeat a single character or [class] instead.'],
  [/^nested quantifiers/, 'Nested repeats are not allowed. Repeat a single character or [class] instead.'],
  [
    /^unbounded/,
    'Unbounded repeats (*, + and {n,}) are not allowed, because they can make scans very slow. Use a bounded range such as {1,20}.',
  ],
  [/^bounded repeats above (\d+)/, 'Repeat counts above $1 are not allowed. Use a smaller range.'],
  [/too many variable-length parts/, 'This pattern has too many variable-length parts. Simplify it.'],
  [/does not compile/, 'This is not a valid regular expression.'],
  [/matches the empty string/, 'This pattern matches empty text, so it would flag everything.'],
]

/** Returns the reason a custom regex is not allowed, or null when it is acceptable. */
export function regexProblem(pattern: string): string | null {
  const reason = customRegexProblem(pattern)
  if (reason === null) return null
  for (const [match, message] of MESSAGES) {
    const found = match.exec(reason)
    if (found) return message.replace('$1', found[1] ?? '')
  }
  return `${reason.charAt(0).toUpperCase()}${reason.slice(1)}.`
}
