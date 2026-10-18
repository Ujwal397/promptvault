import type { Detector, RawFinding } from '../../types'
import { makeFinding, matchAll } from '../util'

const WORD = "[A-Z][a-z]{1,24}(?:['\u2019-][A-Za-z]{1,24})?"
/** The last name word must end at a word boundary: not followed by a letter, digit, underscore or `(`. */
const NAME = `${WORD}(?:[ \t]+${WORD}){0,2}(?![A-Za-z0-9_(])`
const LABEL =
  '(?:[Ff]ull[ \t]+[Nn]ame|[Nn]ame|[Pp]atient(?:[ \t]+[Nn]ame)?|[Cc]ustomer(?:[ \t]+[Nn]ame)?|[Ee]mployee(?:[ \t]+[Nn]ame)?|[Cc]lient(?:[ \t]+[Nn]ame)?)'

const LABELED_RE = new RegExp(`(?<![A-Za-z])(${LABEL})[ \t]{0,3}([:=])[ \t]{0,3}(${NAME})`, 'g')
const DEAR_RE = new RegExp(`(?<![A-Za-z])Dear[ \t]+((?:(?:Mr|Mrs|Ms|Miss|Dr|Prof)\\.?[ \t]+)?${NAME})`, 'g')

const STOPWORDS = new Set([
  'unknown', 'none', 'null', 'test', 'example', 'required', 'optional', 'string', 'team', 'sir', 'madam',
  'all', 'everyone', 'colleagues', 'customer', 'support', 'user', 'sirs', 'friend', 'hiring', 'client',
  'name', 'undefined', 'anonymous', 'redacted', 'admin',
])

/** Common configuration words that follow a bare "name:" key in YAML, JSON-ish or code. */
const CONFIG_WORDS = new Set([
  'production', 'staging', 'development', 'default', 'admin', 'test', 'main', 'master', 'root', 'user',
  'service', 'app', 'server', 'database', 'local', 'none', 'null', 'true', 'false',
])

/**
 * The bare "Name:" / "name=" label is ambiguous. Accept it only with 2+ capitalised words, or a single
 * word in prose/form context (capitalised "Name:" starting its line), and never for config words.
 */
function genericLabelAccepted(text: string, m: RegExpExecArray, value: string): boolean {
  const words = value.split(/\s+/)
  if (CONFIG_WORDS.has(words[0].toLowerCase())) return false
  if (words.length >= 2) return true
  if (m[1] !== 'Name' || m[2] !== ':') return false
  const lineStart = text.lastIndexOf('\n', m.index - 1) + 1
  return text.slice(lineStart, m.index) === ''
}

/** `client = Client.create()`: a code-ish label assigned with `=` whose value is immediately followed by `.` or `(`. */
function codeAssignment(text: string, m: RegExpExecArray, end: number): boolean {
  return m[2] === '=' && /^(?:client|customer|employee)/i.test(m[1]) && /^[.(]/.test(text.slice(end, end + 1))
}

function scan(re: RegExp, text: string, reason: string, out: RawFinding[], generic = false): void {
  for (const m of matchAll(re, text)) {
    const value = m[m.length - 1]
    if (STOPWORDS.has(value.split(/\s+/)[0].toLowerCase())) continue
    if (generic && /^[Nn]ame$/.test(m[1]) && !genericLabelAccepted(text, m, value)) continue
    const start = m.index + m[0].length - value.length
    if (generic && codeAssignment(text, m, start + value.length)) continue
    out.push(
      makeFinding({
        detectorId: 'pii.labeled-name',
        detectorVersion: '1.1.0',
        category: 'person_name',
        start,
        end: start + value.length,
        severity: 'medium',
        confidence: 0.8,
        reasonCode: reason,
        label: 'Person name (labeled)',
        explanation: 'Capitalised words follow a name label such as "Name:", "Patient:" or "Dear".',
        placeholderType: 'PERSON',
      }),
    )
  }
}

export const labeledNameDetector: Detector = {
  id: 'pii.labeled-name',
  version: '1.1.0',
  category: 'person_name',
  description: 'Person names introduced by an explicit label',
  examples: {
    positive: ['Name: Alice Example', 'Patient: Bob Q Sample', 'Dear Mr. Carol Tester,', 'Employee: Dana Doe'],
    negative: ['Name: unknown', 'Dear Team,', 'the name of the file', 'Customer: support'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    scan(LABELED_RE, text, 'LABEL_CONTEXT', out, true)
    scan(DEAR_RE, text, 'SALUTATION_CONTEXT', out)
    return out
  },
}
