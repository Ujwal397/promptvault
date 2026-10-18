import type { Detector, RawFinding } from '../../types'
import { digitsOf, hasLabelBefore, luhnValid, makeFinding, matchAll } from '../util'

const PHONE_LABELS = ['phone', 'mobile', 'tel', 'call', 'cell', 'whatsapp', 'contact no', 'contact number', 'fax']

/** International: + then 8-15 digits with optional separators/parentheses. */
const E164_RE = /(?<![\w+])\+\d[\d ().-]{6,22}\d(?!\d)/g
/** US/NANP with separators or parentheses, optional +1. */
const US_RE =
  /(?<![\w.+-])(?:\+?1[ .-]?)?(?:\([2-9]\d{2}\)[ .-]?|[2-9]\d{2}[ .-])[2-9]\d{2}[ .-]\d{4}(?![\d]|[.-]\d)/g
/** Indian mobile with a separator, optional 0 / 91 prefix. */
const IN_SPACED_RE = /(?<![\w+.-])(?:(?:0|91)[ -]?)?[6-9]\d{4}[ -]\d{5}(?!\d|[.-]\d)/g
/** UK national formats: 07xxx xxxxxx, 02x xxxx xxxx, 01xx xxx xxxx, 01xxx xxxxx(x), (0xxx) xxx xxxx. */
const UK_RE =
  /(?<![\w.+-])(?:\(0\d{2,4}\)[ ]?\d{3,4}[ ]?\d{3,4}|07\d{3}[ ]?\d{6}|02\d[ ]?\d{4}[ ]?\d{4}|01\d{2}[ ]\d{3}[ ]\d{4}|01\d{3}[ ]\d{5,6})(?!\d|[.-]\d)/g
/** Bare digit run: only reported with a phone label. */
const BARE_RE = /(?<![\w.+-])\d{8,15}(?![\w]|[.-]\d)/g

interface Hit {
  start: number
  end: number
  confidence: number
  reason: string
}

function overlapsAny(hits: Hit[], s: number, e: number): boolean {
  return hits.some((h) => s < h.end && h.start < e)
}

function collect(text: string): Hit[] {
  const hits: Hit[] = []
  for (const m of matchAll(E164_RE, text)) {
    const d = digitsOf(m[0])
    if (d.length < 8 || d.length > 15) continue
    const indian = d.startsWith('91') && d.length === 12 && /[6-9]/.test(d[2])
    hits.push({ start: m.index, end: m.index + m[0].length, confidence: indian ? 0.9 : 0.85, reason: indian ? 'IN_MOBILE_FORMAT' : 'E164_FORMAT' })
  }
  for (const m of matchAll(US_RE, text)) {
    hits.push({ start: m.index, end: m.index + m[0].length, confidence: 0.8, reason: 'US_PHONE_FORMAT' })
  }
  for (const m of matchAll(UK_RE, text)) {
    const s = m.index
    const e = s + m[0].length
    const d = digitsOf(m[0])
    const zeros = d.match(/0/g)?.length ?? 0
    if (zeros / d.length >= 0.6 || overlapsAny(hits, s, e)) continue
    hits.push({ start: s, end: e, confidence: 0.8, reason: 'UK_PHONE_FORMAT' })
  }
  for (const m of matchAll(IN_SPACED_RE, text)) {
    const s = m.index
    const e = s + m[0].length
    if (!overlapsAny(hits, s, e)) hits.push({ start: s, end: e, confidence: 0.75, reason: 'IN_MOBILE_FORMAT' })
  }
  for (const m of matchAll(BARE_RE, text)) {
    const s = m.index
    const e = s + m[0].length
    if (overlapsAny(hits, s, e)) continue
    if (!hasLabelBefore(text, s, PHONE_LABELS, 24)) continue
    if (m[0].length >= 13 && luhnValid(m[0])) continue
    hits.push({ start: s, end: e, confidence: 0.45, reason: 'LABELED_DIGITS' })
  }
  return hits
}

export const phoneDetector: Detector = {
  id: 'pii.phone',
  version: '1.1.0',
  category: 'phone',
  description: 'Phone numbers: E.164, US, UK and Indian mobile formats',
  examples: {
    positive: [
      'call +1 415 555 2671 now',
      'phone (212) 555-0100',
      'reach me at 212-555-0100',
      'mobile +91 98765 43210',
      'mobile: 9876543210',
      'Tel 98765 43210',
    ],
    negative: ['date 2024-01-15', 'version 1.2.3.4567', 'card 4111 1111 1111 1111', 'order 9876543210', 'build 20240115'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const h of collect(text)) {
      out.push(
        makeFinding({
          detectorId: 'pii.phone',
          detectorVersion: '1.1.0',
          category: 'phone',
          start: h.start,
          end: h.end,
          severity: 'medium',
          confidence: h.confidence,
          reasonCode: h.reason,
          label: 'Phone number',
          explanation:
            h.reason === 'LABELED_DIGITS'
              ? 'Unformatted digit run next to a phone-related label; low confidence.'
              : 'Digits match a known phone number format.',
          placeholderType: 'PHONE',
        }),
      )
    }
    return out
  },
}
