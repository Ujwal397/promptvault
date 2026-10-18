import type { Detector, RawFinding } from '../../types'
import { digitsOf, hasLabelBefore, luhnValid, makeFinding, matchAll } from '../util'

const V = '1.0.0'

// ---------- Cards ----------
const CARD_RE = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g

function iinOk(d: string): boolean {
  const n = d.length
  const p2 = Number(d.slice(0, 2))
  const p3 = Number(d.slice(0, 3))
  const p4 = Number(d.slice(0, 4))
  if (d[0] === '4') return n === 13 || n === 16 || n === 19
  if ((p2 >= 51 && p2 <= 55) || (p4 >= 2221 && p4 <= 2720)) return n === 16
  if (p2 === 34 || p2 === 37) return n === 15
  if (p4 === 6011 || p2 === 65 || (p3 >= 644 && p3 <= 649) || p2 === 62 || p2 === 35) return n >= 16 && n <= 19
  if (p2 === 36 || p2 === 38 || p2 === 39 || (p3 >= 300 && p3 <= 305)) return n >= 14 && n <= 19
  return false
}

const CARD_GROUPINGS = [
  [4, 4, 4, 4], [4, 4, 4, 4, 3], [4, 6, 4], [4, 6, 5],
  [4, 4, 4, 1], [4, 4, 4, 2], [4, 4, 4, 3],
]

/** Only real card layouts: contiguous digits, or a consistent single-character separator with known groupings. */
function cardGroupingOk(raw: string): boolean {
  const seps = new Set(raw.replace(/\d/g, ''))
  if (seps.size === 0) return true
  if (seps.size > 1) return false
  const sep = [...seps][0]
  if (sep !== ' ' && sep !== '-') return false
  const sizes = raw.split(sep).map((g) => g.length)
  return CARD_GROUPINGS.some((g) => g.length === sizes.length && g.every((n, i) => n === sizes[i]))
}

const mostlyZeros = (d: string): boolean => (d.match(/0/g)?.length ?? 0) / d.length >= 0.75

export const cardDetector: Detector = {
  id: 'fin.card',
  version: '1.1.0',
  category: 'financial',
  description: 'Payment card numbers (Luhn + issuer prefix)',
  examples: {
    positive: ['card 4111 1111 1111 1111', 'pay 5555-5555-5555-4444', 'amex 378282246310005', '4012888888881881'],
    negative: ['4111 1111 1111 1112', '1234 5678 9012 3456', 'timestamp 1700000000000', 'id 12345678'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(CARD_RE, text)) {
      const d = digitsOf(m[0])
      if (d.length < 13 || d.length > 19 || !luhnValid(d) || !iinOk(d)) continue
      if (!cardGroupingOk(m[0]) || mostlyZeros(d)) continue
      out.push(
        makeFinding({
          detectorId: 'fin.card',
          detectorVersion: '1.1.0',
          category: 'financial',
          start: m.index,
          end: m.index + m[0].length,
          severity: 'high',
          confidence: 0.95,
          reasonCode: 'LUHN_VALID',
          label: 'Payment card number',
          explanation: 'Digits pass the Luhn checksum and match a known card issuer prefix.',
          placeholderType: 'CARD',
        }),
      )
    }
    return out
  },
}

// ---------- IBAN ----------
const IBAN_RE = /(?<![A-Za-z0-9])[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?(?![A-Za-z0-9])/g

function ibanMod97(iban: string): boolean {
  const s = iban.replace(/ /g, '')
  if (s.length < 15 || s.length > 34) return false
  const rearranged = s.slice(4) + s.slice(0, 4)
  let rem = 0
  for (const ch of rearranged) {
    const v = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch
    for (const digit of v) rem = (rem * 10 + (digit.charCodeAt(0) - 48)) % 97
  }
  return rem === 1
}

export const ibanDetector: Detector = {
  id: 'fin.iban',
  version: V,
  category: 'financial',
  description: 'IBANs (mod-97 validated)',
  examples: {
    positive: ['IBAN GB82WEST12345698765432', 'pay to DE89 3704 0044 0532 0130 00'],
    negative: ['GB82WEST12345698765433', 'AB12 notiban', 'GB82 WEST'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(IBAN_RE, text)) {
      if (!ibanMod97(m[0])) continue
      out.push(
        makeFinding({
          detectorId: 'fin.iban',
          detectorVersion: V,
          category: 'financial',
          start: m.index,
          end: m.index + m[0].length,
          severity: 'high',
          confidence: 0.95,
          reasonCode: 'IBAN_MOD97',
          label: 'IBAN',
          explanation: 'Value passes the IBAN mod-97 checksum.',
          placeholderType: 'IBAN',
        }),
      )
    }
    return out
  },
}

// ---------- Bank account (label only) ----------
const ACCOUNT_RE = /(?<![\w.-])\d{8,17}(?![\w]|[.-]\d)/g
const ACCOUNT_LABELS = [
  'account number', 'account no', 'account #', 'acct no', 'acct number', 'acct #', 'acct.', 'a/c no', 'a/c number', 'routing', 'account:',
]

export const bankAccountDetector: Detector = {
  id: 'fin.bank-account',
  version: V,
  category: 'financial',
  description: 'Bank account / routing numbers (label context required)',
  examples: {
    positive: ['account number: 12345678', 'Acct No 000123456789', 'routing 021000021'],
    negative: ['12345678 on its own', 'account number: 1234', 'the account is closed'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(ACCOUNT_RE, text)) {
      if (!hasLabelBefore(text, m.index, ACCOUNT_LABELS, 30)) continue
      out.push(
        makeFinding({
          detectorId: 'fin.bank-account',
          detectorVersion: V,
          category: 'financial',
          start: m.index,
          end: m.index + m[0].length,
          severity: 'high',
          confidence: 0.6,
          reasonCode: 'LABEL_CONTEXT',
          label: 'Bank account number',
          explanation: 'An 8-17 digit number follows an account or routing label.',
          placeholderType: 'BANK_ACCOUNT',
        }),
      )
    }
    return out
  },
}

export const FINANCIAL_DETECTORS: Detector[] = [cardDetector, ibanDetector, bankAccountDetector]
