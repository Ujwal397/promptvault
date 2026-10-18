import type { Category, Detector, RawFinding, Severity } from '../../types'
import { makeFinding, matchAll, shannonEntropy } from '../util'

export const DETECTOR_VERSION = '1.0.0'

export const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
export const B64 = ALNUM + '+/'
export const B64URL = ALNUM + '-_'
export const HEX = '0123456789abcdef'

/** Deterministic pseudo-random string for synthetic fixtures (not secure, never real). */
export function fake(length: number, seed = 1, alphabet: string = ALNUM): string {
  let state = (Math.imul(seed, 2654435761) >>> 0) || 1
  let out = ''
  for (let i = 0; i < length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    out += alphabet[(state >>> 16) % alphabet.length]
  }
  return out
}

export function b64url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /^\[[A-Z_]+_\d+\]$/, // our own redaction output, so re-scans come back clean
  /^\[?redacted/i,
  /^\*+$/,
  /^[x*•._-]{3,}$/i,
  /^<[^<>]*>$/,
  /^\$\{[^}]*\}$/,
  /^\$[A-Z_][A-Z0-9_]*$/,
  /^\$\(.*\)$/,
  /^%[A-Za-z_][A-Za-z0-9_]*%$/,
  /^\{\{.*\}\}$/,
  /^\{[A-Za-z_][A-Za-z0-9_]*\}$/,
  /^#\{.*\}$/,
  /^%[sd]$/,
  /^process\.env\b/,
  /^os\.(environ|getenv)\b/,
  /^(?:System\.)?getenv\b/i,
  /^ENV\[/,
  /^env\(/i,
  /^Environment\.GetEnvironmentVariable/i,
  /^your[_-]password(?:[_-]here)?$/i,
  /^your[_-][a-z0-9_-]{1,40}[_-]here$/i,
  /^your[_-](?:api[_-]?key|token|secret|key)$/i,
  /^(?:null|none|nil|undefined|true|false|n\/a|na|todo|tbd|empty|masked|hidden)$/i,
]

/** True for empty values, template references, env lookups and redaction placeholders. */
export function isPlaceholderValue(raw: string): boolean {
  const v = raw.trim()
  if (v.length === 0) return true
  return PLACEHOLDER_PATTERNS.some((re) => re.test(v))
}

const CLASS_CHECKS: readonly RegExp[] = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9_.-]/]

/** Number of distinct character classes (lower, upper, digit, other punctuation). */
export function charClassCount(s: string): number {
  return CLASS_CHECKS.reduce((n, re) => (re.test(s) ? n + 1 : n), 0)
}

export interface ValueSpan {
  value: string
  start: number
  end: number
}

/** First defined capture group at or after `firstGroup`, using match indices (needs the `d` flag). */
export function pickValue(m: RegExpExecArray, firstGroup: number): ValueSpan | null {
  const indices = m.indices
  if (!indices) return null
  for (let g = firstGroup; g < m.length; g++) {
    const span = indices[g]
    const value = m[g]
    if (span && value !== undefined) return { value, start: span[0], end: span[1] }
  }
  return null
}

export interface PatternRule {
  re: RegExp
  /** Capture group holding the secret; the whole match when omitted. */
  group?: number
  label: string
  placeholder: string
  explanation: string
  reasonCode?: string
  confidence: number
  severity: Severity | ((m: RegExpExecArray) => Severity)
  /** Extra acceptance test on the value (e.g. entropy floor). */
  accept?: (value: string, m: RegExpExecArray) => boolean
}

export interface PatternDetectorSpec {
  id: string
  category: Category
  description: string
  examples: { positive: string[]; negative: string[] }
  patterns: PatternRule[]
}

/** Builds a Detector from declarative regex rules. Regexes must carry the `g` flag. */
export function patternDetector(spec: PatternDetectorSpec): Detector {
  const rules = spec.patterns.map((rule) => ({
    ...rule,
    re: rule.re.hasIndices ? rule.re : new RegExp(rule.re.source, rule.re.flags + 'd'),
  }))
  return {
    id: spec.id,
    version: DETECTOR_VERSION,
    category: spec.category,
    description: spec.description,
    examples: spec.examples,
    detect({ text }) {
      const out: RawFinding[] = []
      for (const rule of rules) {
        for (const m of matchAll(rule.re, text)) {
          const span =
            rule.group === undefined
              ? { value: m[0], start: m.index, end: m.index + m[0].length }
              : pickValue(m, rule.group)
          if (!span) continue
          if (rule.accept && !rule.accept(span.value, m)) continue
          out.push(
            makeFinding({
              detectorId: spec.id,
              detectorVersion: DETECTOR_VERSION,
              category: spec.category,
              start: span.start,
              end: span.end,
              severity: typeof rule.severity === 'function' ? rule.severity(m) : rule.severity,
              confidence: rule.confidence,
              reasonCode: rule.reasonCode ?? 'PROVIDER_SIGNATURE',
              label: rule.label,
              explanation: rule.explanation,
              placeholderType: rule.placeholder,
            }),
          )
        }
      }
      return out
    },
  }
}

/** Entropy floor used to reject repetitive look-alikes such as AAAA... */
export function hasMinEntropy(min: number): (value: string) => boolean {
  return (value) => shannonEntropy(value) >= min
}
