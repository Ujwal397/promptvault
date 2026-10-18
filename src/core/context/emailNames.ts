/**
 * Names corroborated by an email address in the same text. "priya.sharma@example.com" is strong evidence that
 * a capitalised "Priya" or "Priya Sharma" elsewhere in the prompt is a person. Scanning is manual (no regex
 * over the whole text), so the cost is linear and ReDoS-free.
 */

export interface NameSpan {
  start: number
  end: number
}

const MAX_LOCAL_PART = 64
const LOCAL_CHAR = /[\p{L}\p{N}._%+-]/u
const SEPARATORS = /[._+-]/u

/** Mailbox words that are roles or filler, never a person's name. */
const ROLE_WORDS = new Set([
  'admin', 'administrator', 'info', 'support', 'noreply', 'reply', 'test', 'tester', 'user', 'users', 'sales',
  'team', 'hello', 'contact', 'dev', 'devops', 'help', 'helpdesk', 'mail', 'email', 'office', 'billing',
  'security', 'account', 'accounts', 'service', 'services', 'jobs', 'careers', 'press', 'news', 'marketing',
  'root', 'webmaster', 'postmaster', 'example', 'demo', 'the', 'and', 'abuse', 'alerts', 'notifications',
  'staff', 'hr', 'legal', 'finance', 'ops', 'orders', 'shop', 'store', 'bot', 'system', 'mailer',
  'daemon', 'feedback', 'enquiries', 'inquiries', 'privacy', 'compliance', 'it', 'qa', 'prod', 'staging',
])

const isNameWord = (w: string): boolean =>
  w.length >= 3 && w.length <= 24 && /^\p{L}+$/u.test(w) && !ROLE_WORDS.has(w.toLowerCase())

/** The local part (before "@") of each email-like token, read backwards from every "@". */
function localParts(text: string): string[] {
  const parts: string[] = []
  for (let at = text.indexOf('@'); at >= 0; at = text.indexOf('@', at + 1)) {
    let start = at
    while (start > 0 && at - start < MAX_LOCAL_PART && LOCAL_CHAR.test(text[start - 1] ?? '')) start--
    if (start < at && /[\p{L}\p{N}]/u.test(text[at + 1] ?? '')) parts.push(text.slice(start, at))
  }
  return parts
}

/** Decides whether a lower-case word is a known given name. */
export type GivenNameTest = (word: string) => boolean

/**
 * Lower-cased name words taken from email local parts, e.g. {"priya", "sharma"}. A local part counts only when at
 * least one of its words is a known given name, so mailboxes like "stripe@" or "github-bot@" never turn brand
 * words into people. Once it counts, its other words (usually the surname) are included too.
 */
export function emailNameWords(text: string, isGivenName: GivenNameTest): Set<string> {
  const words = new Set<string>()
  for (const local of localParts(text)) {
    const parts = local.split(SEPARATORS).filter(isNameWord).map((w) => w.toLowerCase())
    if (parts.some(isGivenName)) for (const word of parts) words.add(word)
  }
  return words
}

const isWordChar = (c: string | undefined): boolean => c !== undefined && /[\p{L}\p{N}_@]/u.test(c)

/** Capitalised whole words (not inside an email, URL or identifier) whose lower case is in `words`. */
function capitalisedHits(text: string, words: Set<string>): NameSpan[] {
  const hits: NameSpan[] = []
  let i = 0
  while (i < text.length) {
    if (!/\p{Lu}/u.test(text[i] ?? '') || isWordChar(text[i - 1]) || text[i - 1] === '.') {
      i++
      continue
    }
    let end = i + 1
    while (end < text.length && end - i <= 24 && /\p{L}/u.test(text[end] ?? '')) end++
    const after = text[end]
    const inToken = isWordChar(after) || (after === '.' && /[\p{L}\p{N}]/u.test(text[end + 1] ?? ''))
    if (!inToken && words.has(text.slice(i, end).toLowerCase())) hits.push({ start: i, end })
    i = end
  }
  return hits
}

/** Spans of names corroborated by an email in the text. "Priya Sharma" (one space apart) becomes one span. */
export function emailCorroboratedNames(text: string, isGivenName: GivenNameTest): NameSpan[] {
  const words = emailNameWords(text, isGivenName)
  if (words.size === 0) return []
  const merged: NameSpan[] = []
  for (const hit of capitalisedHits(text, words)) {
    const last = merged[merged.length - 1]
    if (last && hit.start === last.end + 1 && text[last.end] === ' ') merged[merged.length - 1] = { ...last, end: hit.end }
    else merged.push(hit)
  }
  return merged
}
