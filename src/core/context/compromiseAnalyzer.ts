import nlp from 'compromise'
import type { ContextAnalyzer, RawFinding } from '../types'
import { makeFinding } from '../detectors/util'
import { emailCorroboratedNames, type NameSpan } from './emailNames'
import { EXTRA_GIVEN_NAMES } from './givenNames'

const ID = 'context.compromise-people'
const VERSION = '1.2.0'

let lexiconReady = false

/**
 * Teaches compromise given names its Anglo-centric lexicon misses (see givenNames.ts), once per realm. Done on
 * first use rather than at import, so the module stays side-effect free and tree-shakes out of the main thread.
 */
function ensureLexicon(): void {
  if (lexiconReady) return
  nlp.addWords(Object.fromEntries(EXTRA_GIVEN_NAMES.map((name) => [name, 'FirstName'])))
  lexiconReady = true
}

interface TermOffset {
  start: number
  length: number
}
interface TermJson {
  text: string
  tags?: string[]
  offset?: TermOffset
}
interface PersonJson {
  text: string
  terms?: TermJson[]
}

interface Token {
  start: number
  end: number
}

/** Capitalised words that commonly follow a first name without being a surname. */
const NON_SURNAME = new Set([
  'street', 'st', 'road', 'rd', 'avenue', 'ave', 'lane', 'drive', 'court', 'square', 'park', 'inc', 'ltd', 'llc',
  'corp', 'co', 'company', 'team', 'group', 'university', 'college', 'school', 'institute', 'hospital', 'clinic',
  'bank', 'department', 'dept', 'office', 'center', 'centre', 'foundation', 'association', 'agency', 'society',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november',
  'december',
  'the', 'and', 'but', 'or', 'is', 'was', 'are', 'were', 'be', 'been', 'to', 'in', 'on', 'at', 'for', 'with',
  'from', 'by', 'of', 'as', 'if', 'then', 'when', 'while', 'who', 'what', 'where', 'why', 'how', 'can', 'could',
  'would', 'will', 'should', 'shall', 'may', 'might', 'must', 'do', 'does', 'did', 'has', 'have', 'had', 'not',
  'no', 'yes', 'i', 'we', 'he', 'she', 'they', 'it', 'you', 'this', 'that', 'these', 'those', 'my', 'your', 'our',
  'their', 'his', 'her', 'its', 'please', 'thanks', 'thank', 'hi', 'hello', 'dear', 'regards', 'best', 'also',
  'about', 'after', 'before', 'again', 'today', 'tomorrow', 'yesterday', 'now', 'here', 'there', 'later', 'asked',
  'said', 'says', 'called', 'wants', 'needs', 'sent', 'wrote', 'from', 'just', 'still', 'only',
])

const SURNAME_RE = /^ (\p{Lu}[\p{L}'’-]{1,24})(?![\p{L}\p{N}_@])/u

const NAME_PREFIX_RE = /^\p{L}[\p{L}'’-]*/u
const isCapitalised = (w: string): boolean => /^\p{Lu}/u.test(w)
const isAcronym = (w: string): boolean => w.length >= 2 && w === w.toUpperCase() && w !== w.toLowerCase()

/**
 * A lone given name directly followed (one space) by a capitalised word is probably "Given Surname",
 * unless the next word is a common non-name word. Returns the extended end offset, or null.
 */
function surnameEnd(text: string, tok: Token): number | null {
  if (!/\p{L}$/u.test(text.slice(tok.start, tok.end))) return null
  const m = SURNAME_RE.exec(text.slice(tok.end, tok.end + 28))
  if (!m) return null
  const word = m[1]
  const letters = word.replace(/[^\p{L}]/gu, '')
  if (isAcronym(letters) || NON_SURNAME.has(letters.toLowerCase())) return null
  return tok.end + 1 + word.length
}

function acceptableTerm(word: string, tags: string[]): boolean {
  if (tags.includes('Honorific')) return false
  const letters = word.replace(/[^\p{L}]/gu, '')
  return letters.length >= 2 && isCapitalised(word) && !isAcronym(letters)
}

/** Locates a term in the original text, trusting compromise offsets only when they match exactly. */
function locate(text: string, term: TermJson, cursor: number): Token | null {
  const o = term.offset
  if (o && text.slice(o.start, o.start + o.length) === term.text) {
    return { start: o.start, end: o.start + o.length }
  }
  const at = text.indexOf(term.text, cursor)
  return at >= 0 ? { start: at, end: at + term.text.length } : null
}

/** compromise terms are whitespace-delimited, so "Hartley,oliver@x.com" is one term: keep only the leading name word. */
function trimToName(text: string, tok: Token | null): Token | null {
  if (!tok) return null
  const lead = NAME_PREFIX_RE.exec(text.slice(tok.start, tok.end))
  return lead ? { start: tok.start, end: tok.start + lead[0].length } : tok
}

function runsOf(text: string, person: PersonJson, cursor: number): Token[][] {
  const runs: Token[][] = []
  let run: Token[] = []
  let pos = cursor
  for (const term of person.terms ?? []) {
    const tok = trimToName(text, locate(text, term, pos))
    if (tok) pos = tok.end
    if (tok && acceptableTerm(term.text, term.tags ?? [])) {
      run.push(tok)
    } else if (run.length > 0) {
      runs.push(run)
      run = []
    }
  }
  if (run.length > 0) runs.push(run)
  return runs
}

const overlaps = (a: NameSpan, b: NameSpan): boolean => a.start < b.end && b.start < a.end

/** A name that also appears in an email in the same text ("Priya" + priya.sharma@…) is corroborated. */
function emailNameFinding(span: NameSpan): RawFinding {
  return makeFinding({
    detectorId: ID,
    detectorVersion: VERSION,
    category: 'person_name',
    start: span.start,
    end: span.end,
    severity: 'medium',
    confidence: 0.75,
    reasonCode: 'NLP_PERSON_EMAIL',
    recommendedAction: 'redact',
    label: 'Person name',
    explanation: 'This name also appears in an email address in the same text, so it is very likely a person.',
    placeholderType: 'PERSON',
    source: 'contextual',
  })
}

interface NlpSpan extends NameSpan {
  confidence: number
}

function nlpFinding(span: NlpSpan): RawFinding {
  return makeFinding({
    detectorId: ID,
    detectorVersion: VERSION,
    category: 'person_name',
    start: span.start,
    end: span.end,
    severity: 'medium',
    confidence: span.confidence,
    reasonCode: 'NLP_PERSON',
    recommendedAction: 'review',
    label: 'Possible person name',
    explanation: 'A local language model heuristic thinks this text is a person name; advisory only.',
    placeholderType: 'PERSON',
    source: 'contextual',
  })
}

/** Person spans from compromise, with a lone given name extended by a following capitalised surname. */
function nlpSpans(text: string): NlpSpan[] {
  const people = nlp(text).people().out('offset') as unknown as PersonJson[]
  const spans: NlpSpan[] = []
  let cursor = 0
  for (const person of people) {
    for (const run of runsOf(text, person, cursor)) {
      const start = run[0].start
      const last = run[run.length - 1]
      const extended = run.length === 1 ? surnameEnd(text, last) : null
      const end = extended ?? last.end
      if (end <= start) continue
      cursor = Math.max(cursor, end)
      spans.push({ start, end, confidence: run.length > 1 || extended !== null ? 0.7 : 0.55 })
    }
  }
  return spans
}

/** compromise's own lexicon plus EXTRA_GIVEN_NAMES (after ensureLexicon). */
const isGivenName = (word: string): boolean => nlp(word.charAt(0).toUpperCase() + word.slice(1)).has('#FirstName')

/**
 * Widens each email-corroborated span to cover the compromise spans it overlaps ("Oliver" → "Oliver Hartley"), and
 * returns the compromise spans no corroborated name touched. Both inputs are sorted by start, so this is one pass.
 */
function reconcile(corroborated: readonly NameSpan[], spans: readonly NlpSpan[]) {
  const used = new Set<number>()
  const widened: NameSpan[] = []
  let j = 0
  for (const span of corroborated) {
    while (j < spans.length && spans[j].end <= span.start) j++
    let current = span
    for (let k = j; k < spans.length && spans[k].start < current.end; k++) {
      if (!overlaps(spans[k], current)) continue
      current = { start: Math.min(current.start, spans[k].start), end: Math.max(current.end, spans[k].end) }
      used.add(k)
    }
    const last = widened[widened.length - 1]
    if (last && overlaps(last, current)) widened[widened.length - 1] = { start: last.start, end: Math.max(last.end, current.end) }
    else widened.push(current)
  }
  return { widened, uncorroborated: spans.filter((_, i) => !used.has(i)) }
}

export const compromiseAnalyzer: ContextAnalyzer = {
  id: ID,
  version: VERSION,
  analyze(text: string): RawFinding[] {
    if (text.length === 0) return []
    ensureLexicon()
    const spans = nlpSpans(text)
    // A corroborated name replaces any compromise span it overlaps, at higher confidence.
    const { widened, uncorroborated } = reconcile(emailCorroboratedNames(text, isGivenName), spans)
    return [...widened.map(emailNameFinding), ...uncorroborated.map(nlpFinding)]
  },
}
