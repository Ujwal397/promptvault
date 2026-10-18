import type { Detector, RawFinding } from '../../types'
import { makeFinding, matchAll, shannonEntropy } from '../util'
import { charClassCount, DETECTOR_VERSION, fake, isPlaceholderValue, pickValue, type ValueSpan } from './helpers'

/** Value part shared by assignment regexes: quoted forms (groups 1-3) or bare token (group 4 of the tail). */
const VALUE = `(?:"([^"\\r\\n]{1,256})"|'([^'\\r\\n]{1,256})'|\`([^\`\\r\\n]{1,256})\`|([^\\s"'\`,;]{1,256}))`
const OPERATOR = `["']?[ \\t]{0,3}(?:=>|:=|==|=|:)[ \\t]{0,5}`

const PASSWORD_RE = new RegExp(
  `(?<![A-Za-z0-9])([A-Za-z0-9_.-]{0,30}?)(password|passwd|pwd|pass)(?![A-Za-z0-9])${OPERATOR}${VALUE}`,
  'dgi',
)
const MYSQL_P_RE =
  /(?<![A-Za-z0-9_-])(?:mysql|mysqldump|mysqladmin|mariadb)\b[^\n]{0,120}?[ \t]-p([^\s"'-][^\s"']{2,63})/dgi
const LONG_FLAG_RE = /(?<![A-Za-z0-9_-])--password[ \t]+(?:"([^"\r\n]{1,128})"|'([^'\r\n]{1,128})'|([^\s"'-][^\s"']{0,127}))/dg
const SSHPASS_RE = /(?<![A-Za-z0-9_-])sshpass[ \t]+-p[ \t]*(?:"([^"\r\n]{1,128})"|'([^'\r\n]{1,128})'|([^\s"'-][^\s"']{0,127}))/dg

const WEAK_PASSWORDS = new Set(['changeme', 'password', 'admin', 'letmein', '123456', 'qwerty', 'password1', 'passw0rd'])
const NON_VALUES = new Set([
  'string', 'required', 'optional', 'text', 'number', 'int', 'integer', 'bool', 'boolean', 'str', 'hash',
  'value', 'field', 'input', 'type', 'yes', 'no', 'on', 'off', 'enabled', 'disabled', 'dummy', 'example',
])

/** Dotted member access or lowercase_snake variable reference rather than a literal value. */
function looksLikeReference(v: string): boolean {
  return /^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+$/.test(v) || /^[a-z]+(?:_[a-z]+)+$/.test(v) || /[()]/.test(v)
}

function trimTrailing(v: ValueSpan): ValueSpan {
  const trimmed = v.value.replace(/[)\]}.>]+$/, '')
  return trimmed.length === v.value.length ? v : { value: trimmed, start: v.start, end: v.start + trimmed.length }
}

function quotedValue(m: RegExpExecArray, firstGroup: number): { v: ValueSpan; quoted: boolean } | null {
  const v = pickValue(m, firstGroup)
  if (!v) return null
  const quoted = m.indices ? v.start > 0 && /["'`]/.test(m.input[v.start - 1] ?? '') : false
  return { v: quoted || isPlaceholderValue(v.value) ? v : trimTrailing(v), quoted }
}

function passwordFinding(v: ValueSpan, label: string): RawFinding {
  const weak = WEAK_PASSWORDS.has(v.value.toLowerCase())
  return makeFinding({
    detectorId: 'secret.password-assignment',
    detectorVersion: DETECTOR_VERSION,
    category: 'credential',
    start: v.start,
    end: v.end,
    severity: 'critical',
    confidence: weak ? 0.7 : 0.85,
    reasonCode: 'PASSWORD_ASSIGNMENT',
    label,
    explanation: weak
      ? 'A value is assigned to a password-like key and is a commonly used weak password.'
      : 'A value is assigned to a key named like a password.',
    placeholderType: 'PASSWORD',
  })
}

const CAMEL_IDENTIFIER_RE = /^[a-z]+(?:[A-Z][a-z]+)+$/

function acceptPassword(v: ValueSpan, quoted: boolean, codeAssignment = false): boolean {
  if (v.value.length < 4 || isPlaceholderValue(v.value)) return false
  if (NON_VALUES.has(v.value.toLowerCase())) return false
  if (quoted) return (v.value.match(/ /g)?.length ?? 0) < 2
  if (codeAssignment && CAMEL_IDENTIFIER_RE.test(v.value)) return false
  return !looksLikeReference(v.value)
}

const detectPassword = ({ text }: { text: string }): RawFinding[] => {
  const out: RawFinding[] = []
  for (const m of matchAll(PASSWORD_RE, text)) {
    const prefix = m[1]
    const key = m[2].toLowerCase()
    if (key === 'pass' && prefix !== '' && !/[_.-]$/.test(prefix)) continue
    const picked = quotedValue(m, 3)
    // A code assignment uses "=" with a lower-case key; env files (ALL_CAPS) and YAML (":") are not code.
    if (!picked) continue
    const head = text.slice(m.index, picked.v.start)
    const codeAssignment = /=/.test(head) && /[a-z]/.test(prefix + m[2]) && !/[A-Z]{2,}_/.test(prefix)
    if (!acceptPassword(picked.v, picked.quoted, codeAssignment)) continue
    if (key === 'pwd' && /^[/~]/.test(picked.v.value)) continue
    out.push(passwordFinding(picked.v, 'Password'))
  }
  const cli: [RegExp, number, string][] = [
    [MYSQL_P_RE, 1, 'Password (command-line flag)'],
    [LONG_FLAG_RE, 1, 'Password (--password flag)'],
    [SSHPASS_RE, 1, 'Password (sshpass flag)'],
  ]
  for (const [re, group, label] of cli) {
    for (const m of matchAll(re, text)) {
      const v = pickValue(m, group)
      if (v && v.value.length >= 3 && !isPlaceholderValue(v.value)) out.push(passwordFinding(v, label))
    }
  }
  return out
}

export const passwordAssignmentDetector: Detector = {
  id: 'secret.password-assignment',
  version: DETECTOR_VERSION,
  category: 'credential',
  description: 'Password assigned in code, JSON, YAML, env files or CLI flags',
  examples: {
    positive: [
      'password = "hunter2xyz"',
      'DB_PASSWORD=Tr0ub4dor&3',
      '{"password": "s3cret-value!"}',
      'password: correcthorse9',
      'mysql -u root -pSup3rSecret mydb',
      'tool --password Zx81qLmn',
      'pwd => \'aB3$kLm9\'',
      'password: changeme',
    ],
    negative: [
      'password: ${DB_PASS}',
      'password = process.env.DB_PASSWORD',
      'password = os.environ["PW"]',
      'password: ""',
      'password: ***',
      'password: <password>',
      'password = null',
      'password: your_password_here',
      'password: [REDACTED]',
      'password: [PASSWORD_1]',
      'Please reset your password',
      'compass: northeast',
      'password: string',
      'password = config.db.password',
    ],
  },
  detect: detectPassword,
}

const GENERIC_KEYS =
  '(?:api[_-]?key|secret[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token|private[_-]?token|signing[_-]?key|secret|token)'
const GENERIC_RE = new RegExp(
  `(?<![A-Za-z0-9])[A-Za-z0-9_.-]{0,30}?${GENERIC_KEYS}(?![A-Za-z0-9])${OPERATOR}${VALUE}`,
  'dgi',
)

function genericConfidence(value: string): number {
  const entropyPart = Math.min(1, Math.max(0, (shannonEntropy(value) - 2.5) / 2)) * 0.2
  const lengthPart = value.length >= 32 ? 0.1 : value.length >= 20 ? 0.05 : 0
  return Math.min(0.9, 0.6 + entropyPart + lengthPart)
}

function acceptGeneric(value: string): boolean {
  if (value.length < 12 || isPlaceholderValue(value)) return false
  if (looksLikeReference(value) || /^(?:https?:\/\/|\/|\.\/|~\/)/i.test(value)) return false
  return charClassCount(value) >= 2
}

export const genericAssignmentDetector: Detector = {
  id: 'secret.generic-assignment',
  version: DETECTOR_VERSION,
  category: 'credential',
  description: 'API key / secret / token style keys assigned a long value',
  examples: {
    positive: [
      'api_key = "' + fake(32, 70) + '"',
      'CLIENT_SECRET=' + fake(24, 71),
      '"accessToken": "' + fake(30, 72) + '"',
      'x-auth-token: ' + fake(28, 73),
    ],
    negative: [
      'api_key = "short"',
      'token: ${GITHUB_TOKEN}',
      'secret: my-kubernetes-secret-name',
      'api_key = config.settings.api_key',
      'token = "[SECRET_1]"',
      'secret = process.env.APP_SECRET_VALUE',
      'the token was revoked',
      'token: https://example.com/oauth/token',
    ],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(GENERIC_RE, text)) {
      const picked = quotedValue(m, 1)
      if (!picked || !acceptGeneric(picked.v.value)) continue
      out.push(
        makeFinding({
          detectorId: 'secret.generic-assignment',
          detectorVersion: DETECTOR_VERSION,
          category: 'credential',
          start: picked.v.start,
          end: picked.v.end,
          severity: 'high',
          confidence: genericConfidence(picked.v.value),
          reasonCode: 'LABEL_CONTEXT',
          label: 'Secret or token assignment',
          explanation: 'A long value is assigned to a key named like an API key, secret or token.',
          placeholderType: 'SECRET',
        }),
      )
    }
    return out
  },
}

export const ASSIGNMENT_DETECTORS: Detector[] = [passwordAssignmentDetector, genericAssignmentDetector]
