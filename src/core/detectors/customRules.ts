import type { CustomRule, Detector, EngineError, RawFinding } from '../types'
import { makeFinding, matchAll } from './util'

const MAX_MATCHES_PER_RULE = 1000

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const isUnbounded = (q: string): boolean => q === '*' || q === '+' || /^\{\d+,\}$/.test(q)

/** Reads a quantifier starting at `i`; returns its text ('' when none). */
function readQuantifier(p: string, i: number): string {
  const c = p[i]
  if (c === '*' || c === '+' || c === '?') return c
  if (c === '{') {
    const close = p.indexOf('}', i)
    if (close > 0 && /^\{\d+(,\d*)?\}$/.test(p.slice(i, close + 1))) return p.slice(i, close + 1)
  }
  return ''
}

interface Frame {
  hasQuant: boolean
  alts: string[]
  cur: string
}

const BROAD_START = new Set(['.', '[', '(', '\\w', '\\d', '\\s', '\\W', '\\D', '\\S'])

function overlappingAlternatives(alts: string[]): boolean {
  const firsts = alts.map((a) => (a.startsWith('\\') ? a.slice(0, 2) : a.slice(0, 1)))
  if (firsts.some((f) => f === '' || BROAD_START.has(f))) return true
  return new Set(firsts).size !== firsts.length
}

/** Heuristic ReDoS check: nested quantifiers and ambiguous alternation under an unbounded quantifier. */
export function hasNestedQuantifier(p: string): boolean {
  const stack: Frame[] = []
  let top: Frame = { hasQuant: false, alts: [], cur: '' }
  let i = 0
  while (i < p.length) {
    const c = p[i]
    if (c === '\\') {
      top.cur += p.slice(i, i + 2)
      const q = readQuantifier(p, i + 2)
      if (q && q !== '?') top.hasQuant = true
      i += 2 + q.length
      top.cur += q
      continue
    }
    if (c === '[') {
      let j = i + 1
      while (j < p.length && p[j] !== ']') j += p[j] === '\\' ? 2 : 1
      top.cur += p.slice(i, j + 1)
      const q = readQuantifier(p, j + 1)
      if (q && q !== '?') top.hasQuant = true
      i = j + 1 + q.length
      top.cur += q
      continue
    }
    if (c === '(') {
      stack.push(top)
      top = { hasQuant: false, alts: [], cur: '' }
      i += 1
      if (p.startsWith('?:', i)) i += 2
      else if (p.startsWith('?=', i) || p.startsWith('?!', i)) i += 2
      continue
    }
    if (c === '|') {
      top.alts.push(top.cur)
      top.cur = ''
      i++
      continue
    }
    if (c === ')') {
      top.alts.push(top.cur)
      const inner = top
      const parent = stack.pop()
      if (!parent) return false
      const q = readQuantifier(p, i + 1)
      if (q && q !== '?' && inner.hasQuant) return true
      if (isUnbounded(q) && inner.alts.length > 1 && overlappingAlternatives(inner.alts)) return true
      top = parent
      if (inner.hasQuant || (q && q !== '?')) top.hasQuant = true
      top.cur += '()'
      i += 1 + q.length
      continue
    }
    const q = readQuantifier(p, i + 1)
    top.cur += c + q
    if (q && q !== '?') top.hasQuant = true
    i += 1 + q.length
  }
  return false
}

const MAX_BOUNDED_REPEAT = 100

/**
 * Conservative ReDoS gate: no unbounded quantifiers, a bounded backtracking budget, no quantified
 * groups, no backreferences, no lookarounds, and bounded repeats capped at MAX_BOUNDED_REPEAT.
 * Returns a rejection reason, or null when the pattern is acceptable.
 */
export function unsafePatternReason(p: string): string | null {
  let backtrackBudget = 1
  let i = 0
  while (i < p.length) {
    const c = p[i]
    let quantifiable = true
    if (c === '\\') {
      if (/[1-9kK]/.test(p[i + 1] ?? '')) return 'backreferences are not allowed'
      i += 2
    } else if (c === '[') {
      let j = i + 1
      while (j < p.length && p[j] !== ']') j += p[j] === '\\' ? 2 : 1
      i = j + 1
    } else if (c === '(') {
      if (/^\(\?(?:<[=!]|[=!])/.test(p.slice(i, i + 4))) return 'lookarounds are not allowed'
      i += 1
      quantifiable = false
    } else if (c === ')') {
      if (readQuantifier(p, i + 1)) return 'quantified groups are not allowed'
      i += 1
      quantifiable = false
    } else {
      i += 1
    }
    if (!quantifiable) continue
    const q = readQuantifier(p, i)
    if (!q) continue
    i += q.length
    if (p[i] === '?') i++
    // Even a single unbounded quantifier is quadratic over 100k chars in a backtracking engine (e.g. a+b on "aaa…").
    if (isUnbounded(q)) return 'unbounded quantifiers (*, +, {n,}) are not allowed; use a bounded range like {1,64}'
    const nums = (q.match(/\d+/g) ?? ['0', '1']).map(Number)
    const max = Math.max(...nums)
    if (max > MAX_BOUNDED_REPEAT) return `bounded repeats above ${MAX_BOUNDED_REPEAT} are not allowed`
    backtrackBudget *= max - Math.min(...nums) + 1
    if (backtrackBudget > MAX_BACKTRACK_BUDGET) return 'pattern has too many variable-length parts'
  }
  return null
}

/** Upper bound on combined repeat choices per match attempt; keeps worst case ~linear × budget. */
const MAX_BACKTRACK_BUDGET = 1000

function compileRegex(rule: Pick<CustomRule, 'pattern' | 'caseSensitive'>): RegExp | string {
  const p = rule.pattern
  if (/\\[1-9]|\\k</.test(p)) return 'backreferences are not allowed'
  if (/\(\?<[=!]/.test(p)) return 'lookbehind is not allowed'
  const unsafe = unsafePatternReason(p)
  if (unsafe) return unsafe
  if (hasNestedQuantifier(p)) return 'nested quantifiers are not allowed'
  let re: RegExp
  try {
    re = new RegExp(p, rule.caseSensitive ? 'g' : 'gi')
  } catch {
    return 'pattern does not compile'
  }
  if (new RegExp(re.source, re.flags).test('')) return 'pattern matches the empty string'
  return re
}

/**
 * Why a custom regex rule would be rejected at scan time, or null when it compiles and is safe. Runs exactly
 * the scanner's checks, so a form can explain a rejection before the rule is saved.
 */
export function customRegexProblem(pattern: string): string | null {
  const compiled = compileRegex({ pattern, caseSensitive: false })
  return typeof compiled === 'string' ? compiled : null
}

function compileKeyword(rule: CustomRule): RegExp {
  const kw = rule.pattern
  const pre = /^\w/.test(kw) ? '\\b' : ''
  const post = /\w$/.test(kw) ? '\\b' : ''
  return new RegExp(`${pre}${escapeRegex(kw)}${post}`, rule.caseSensitive ? 'g' : 'gi')
}

function toDetector(rule: CustomRule, re: RegExp): Detector {
  const id = `custom.${rule.id}`
  const isKeyword = rule.kind === 'keyword'
  return {
    id,
    version: '1.0.0',
    category: 'custom',
    description: `Custom ${rule.kind} rule: ${rule.name}`,
    examples: { positive: [], negative: [] },
    detect({ text }) {
      const out: RawFinding[] = []
      for (const m of matchAll(re, text)) {
        if (m[0].length === 0) continue
        out.push(
          makeFinding({
            detectorId: id,
            detectorVersion: '1.0.0',
            category: 'custom',
            start: m.index,
            end: m.index + m[0].length,
            severity: rule.severity,
            confidence: isKeyword ? 0.9 : 0.85,
            reasonCode: isKeyword ? 'CUSTOM_KEYWORD' : 'CUSTOM_REGEX',
            recommendedAction: 'review',
            label: rule.name,
            explanation: `Matched your custom ${rule.kind} rule "${rule.name}".`,
            placeholderType: rule.placeholderType,
            source: 'custom',
          }),
        )
        if (out.length >= MAX_MATCHES_PER_RULE) break
      }
      return out
    },
  }
}

export function buildCustomDetectors(rules: CustomRule[]): { detectors: Detector[]; errors: EngineError[] } {
  const detectors: Detector[] = []
  const errors: EngineError[] = []
  for (const rule of rules) {
    if (!rule.enabled) continue
    const id = `custom.${rule.id}`
    if (rule.kind === 'keyword') {
      detectors.push(toDetector(rule, compileKeyword(rule)))
      continue
    }
    const compiled = compileRegex(rule)
    if (typeof compiled === 'string') {
      errors.push({ code: 'POLICY_INVALID', message: `Custom rule "${rule.id}" rejected: ${compiled}.`, detectorId: id })
    } else {
      detectors.push(toDetector(rule, compiled))
    }
  }
  return { detectors, errors }
}
