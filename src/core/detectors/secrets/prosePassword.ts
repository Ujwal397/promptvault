import type { Detector, RawFinding } from '../../types'
import { makeFinding, matchAll } from '../util'
import { DETECTOR_VERSION, isPlaceholderValue } from './helpers'

const KEYWORD_RE = /(?<![A-Za-z0-9_])(password|passwd|passphrase|passcode|pwd|pin|pass)(?![A-Za-z0-9_])/gi
/** keyword ... (connector) value, same line, gap bounded and lazy. */
const CONNECTOR_RE = /[^\r\n]{0,40}?(?:[ \t]+(?:is|was|of|would be|will be)[ \t]+|[ \t]{0,3}[:=-][ \t]{0,3})(\S{4,64})(?!\S)/dy
/** keyword value ("use password X", "and password X"). */
const DIRECT_RE = /[ \t]{1,3}(\S{4,64})(?!\S)/dy

const NON_VALUES = new Set([
  'required', 'incorrect', 'wrong', 'reset', 'expired', 'changed', 'strong', 'weak', 'protected', 'empty',
  'missing', 'hidden', 'set', 'the', 'a', 'my', 'your', 'not', 'too', 'policy', 'manager', 'field', 'prompt',
  'hash', 'salt', 'again', 'must', 'should', 'please', 'when', 'that', 'this', 'with', 'from', 'here',
])
const CAMEL_IDENTIFIER_RE = /^[a-z]+(?:[A-Z][a-z]+)+$/
const DOTTED_REFERENCE_RE = /^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+$/
const COUNT_PHRASE_RE = /^\d+-?(?:char|character|digit|letter|symbol|word)s?$/i

interface Candidate {
  value: string
  start: number
  end: number
}

/** Strips wrapping quotes/brackets and sentence punctuation, keeping offsets exact. */
function strip(raw: string, start: number): Candidate {
  const lead = /^[("'`\u201c\u2018[{<]+/.exec(raw)?.[0].length ?? 0
  const rest = raw.slice(lead)
  const trail = /[)"'`\u201d\u2019\]}>.,;]+$/.exec(rest)?.[0].length ?? 0
  const value = rest.slice(0, rest.length - trail)
  return { value, start: start + lead, end: start + lead + value.length }
}

function looksSecret(value: string, keyword: string): boolean {
  if (/^\d{4,8}$/.test(value) && (keyword === 'passcode' || keyword === 'pin')) return true
  if (/[0-9]/.test(value) || /[^A-Za-z0-9_-]/.test(value)) return true
  return /[a-z]/.test(value) && /[A-Z]/.test(value.slice(1))
}

function accept(raw: string, c: Candidate, keyword: string): boolean {
  const v = c.value
  // strip() removes wrapping brackets, so "[PASSWORD_1]" arrives as "PASSWORD_1": re-check the bracketed form.
  const bracketed = raw.includes(`[${v}]`) && isPlaceholderValue(`[${v}]`)
  if (v.length < 4 || bracketed || isPlaceholderValue(raw) || isPlaceholderValue(v)) return false
  if (NON_VALUES.has(v.toLowerCase()) || COUNT_PHRASE_RE.test(v)) return false
  if (/[()]/.test(v) || DOTTED_REFERENCE_RE.test(v) || CAMEL_IDENTIFIER_RE.test(v)) return false
  return looksSecret(v, keyword)
}

function candidateAt(re: RegExp, text: string, from: number, keyword: string): Candidate | null {
  const sticky = new RegExp(re.source, re.flags)
  sticky.lastIndex = from
  const m = sticky.exec(text)
  const span = m?.indices?.[1]
  if (!m || !span) return null
  const c = strip(m[1], span[0])
  return accept(m[1], c, keyword) ? c : null
}

const detect = ({ text }: { text: string }): RawFinding[] => {
  const out: RawFinding[] = []
  for (const m of matchAll(KEYWORD_RE, text)) {
    const keyword = m[1].toLowerCase()
    const from = m.index + m[0].length
    const c = candidateAt(CONNECTOR_RE, text, from, keyword) ?? candidateAt(DIRECT_RE, text, from, keyword)
    if (!c) continue
    const pin = keyword === 'pin' || keyword === 'passcode'
    out.push(
      makeFinding({
        detectorId: 'secret.prose-password',
        detectorVersion: DETECTOR_VERSION,
        category: 'credential',
        start: c.start,
        end: c.end,
        severity: 'critical',
        confidence: keyword === 'pin' ? 0.65 : 0.75,
        reasonCode: 'PROSE_PASSWORD',
        label: pin ? 'PIN or passcode in text' : 'Password stated in text',
        explanation: 'A secret-looking value follows a password-like word in natural language.',
        placeholderType: pin ? 'PIN' : 'PASSWORD',
      }),
    )
  }
  return out
}

export const prosePasswordDetector: Detector = {
  id: 'secret.prose-password',
  version: DETECTOR_VERSION,
  category: 'credential',
  description: 'Passwords or PINs disclosed in natural-language sentences',
  examples: {
    positive: ['my password is Tr0ub4dor&3', 'the PIN is 4829', 'use password Xy9#kLm2'],
    negative: ['Please reset your password', 'password is required', 'pin the issue to the top', 'my password is [PASSWORD_1]'],
  },
  detect,
}

export const PROSE_PASSWORD_DETECTORS: Detector[] = [prosePasswordDetector]
