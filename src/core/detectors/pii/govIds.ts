import type { Detector, RawFinding } from '../../types'
import { digitsOf, hasLabelBefore, makeFinding, matchAll } from '../util'
import { LABELED_FAILED_CONFIDENCE, LABELED_FAILED_REASON, hasWholeLabelBefore } from './labelFailed'
import { verhoeffAppend, verhoeffValid } from './verhoeff'

const V = '1.0.0'
const V11 = '1.1.0'

export interface GovSpec {
  id: string
  start: number
  end: number
  confidence: number
  reason: string
  label: string
  placeholder: string
  why: string
  version?: string
}

export function gov(s: GovSpec): RawFinding {
  return makeFinding({
    detectorId: s.id,
    detectorVersion: s.version ?? V,
    category: 'gov_id',
    start: s.start,
    end: s.end,
    severity: 'high',
    confidence: s.confidence,
    reasonCode: s.reason,
    label: s.label,
    explanation: s.why,
    placeholderType: s.placeholder,
  })
}

/** Uncertain finding: an explicit label precedes a value in the right format that fails checksum/prefix validation. */
export function govFailed(s: Pick<GovSpec, 'id' | 'start' | 'end' | 'label' | 'placeholder'>): RawFinding {
  return gov({
    ...s,
    version: V11,
    confidence: LABELED_FAILED_CONFIDENCE,
    reason: LABELED_FAILED_REASON,
    why: 'Value follows an explicit identifier label and has the right format, but fails its checksum or prefix validation; it may still be a real or mistyped identifier.',
  })
}

// ---------- US SSN ----------
const SSN_DASHED = /(?<![\d-])(\d{3})-(\d{2})-(\d{4})(?!\d|-\d)/g
const SSN_BARE = /(?<![\w-])(\d{3})(\d{2})(\d{4})(?![\w-])/g
const SSN_LABELS = ['ssn', 'social security', 'social sec']

function ssnValid(area: string, group: string, serial: string): boolean {
  return area !== '000' && area !== '666' && area[0] !== '9' && group !== '00' && serial !== '0000'
}

export const ssnDetector: Detector = {
  id: 'gov.us-ssn',
  version: V11,
  category: 'gov_id',
  description: 'US Social Security Numbers',
  examples: {
    positive: ['SSN 123-45-6789', 'my number is 219-09-9999', 'social security: 123456789'],
    negative: ['000-12-3456', '666-12-3456', '900-12-3456', '123-00-6789', '123-45-0000', 'order 123456789'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    const base = { id: 'gov.us-ssn', label: 'US Social Security number', placeholder: 'SSN', version: V11, why: 'Digits satisfy US SSN area, group and serial rules.' }
    for (const m of matchAll(SSN_DASHED, text)) {
      const span = { start: m.index, end: m.index + m[0].length }
      if (ssnValid(m[1], m[2], m[3])) out.push(gov({ ...base, ...span, confidence: 0.9, reason: 'SSN_FORMAT' }))
      else if (hasWholeLabelBefore(text, m.index, SSN_LABELS, 25)) out.push(govFailed({ ...base, ...span }))
    }
    for (const m of matchAll(SSN_BARE, text)) {
      if (!hasLabelBefore(text, m.index, SSN_LABELS, 25)) continue
      const span = { start: m.index, end: m.index + m[0].length }
      if (ssnValid(m[1], m[2], m[3])) out.push(gov({ ...base, ...span, confidence: 0.7, reason: 'SSN_LABEL_CONTEXT' }))
      else out.push(govFailed({ ...base, ...span }))
    }
    return out
  },
}

// ---------- Aadhaar ----------
const AADHAAR_RE = /(?<!\d[ -]?)[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?![ -]?\d)/g
const AADHAAR_LABELS = ['aadhaar', 'aadhar', 'uidai', 'uid']
const AADHAAR_SAMPLE = verhoeffAppend('23456789012')

export const aadhaarDetector: Detector = {
  id: 'gov.in-aadhaar',
  version: V11,
  category: 'gov_id',
  description: 'Indian Aadhaar numbers (Verhoeff checksum)',
  examples: {
    positive: [
      `Aadhaar ${AADHAAR_SAMPLE.slice(0, 4)} ${AADHAAR_SAMPLE.slice(4, 8)} ${AADHAAR_SAMPLE.slice(8)}`,
      `uid ${AADHAAR_SAMPLE}`,
    ],
    negative: ['2345 6789 0120 1', '1234 5678 9012', 'card 4111 1111 1111 1111'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(AADHAAR_RE, text)) {
      const d = digitsOf(m[0])
      if (d.length !== 12) continue
      const labeled = hasLabelBefore(text, m.index, AADHAAR_LABELS, 25)
      if (!verhoeffValid(d)) {
        if (hasWholeLabelBefore(text, m.index, AADHAAR_LABELS, 25)) {
          out.push(govFailed({ id: 'gov.in-aadhaar', start: m.index, end: m.index + m[0].length, label: 'Aadhaar number', placeholder: 'AADHAAR' }))
        }
        continue
      }
      const spaced = /[ -]/.test(m[0])
      out.push(
        gov({
          id: 'gov.in-aadhaar',
          version: V11,
          start: m.index,
          end: m.index + m[0].length,
          confidence: labeled ? 0.92 : spaced ? 0.8 : 0.7,
          reason: 'VERHOEFF_VALID',
          label: 'Aadhaar number',
          placeholder: 'AADHAAR',
          why: 'Twelve digits pass the Verhoeff checksum used by Aadhaar.',
        }),
      )
    }
    return out
  },
}

// ---------- PAN ----------
const PAN_RE = /(?<![A-Za-z0-9])[A-Z]{3}([A-Z])[A-Z]\d{4}[A-Z](?![A-Za-z0-9])/g
const PAN_LABELS = ['pan', 'permanent account']
const PAN_HOLDER_TYPES = 'ABCFGHLJPT'

export const panDetector: Detector = {
  id: 'gov.in-pan',
  version: V11,
  category: 'gov_id',
  description: 'Indian PAN (Permanent Account Number)',
  examples: {
    positive: ['PAN ABCPD1234E', 'tax id: AAACB1234C'],
    negative: ['ABCDE1234F', 'abcpd1234e', 'ABCPD12345', 'XABCPD1234E'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(PAN_RE, text)) {
      if (!PAN_HOLDER_TYPES.includes(m[1])) {
        if (hasWholeLabelBefore(text, m.index, PAN_LABELS, 25)) {
          out.push(govFailed({ id: 'gov.in-pan', start: m.index, end: m.index + m[0].length, label: 'Indian PAN', placeholder: 'PAN' }))
        }
        continue
      }
      const labeled = hasLabelBefore(text, m.index, PAN_LABELS, 25)
      out.push(
        gov({
          id: 'gov.in-pan',
          version: V11,
          start: m.index,
          end: m.index + m[0].length,
          confidence: labeled ? 0.92 : 0.8,
          reason: 'PAN_FORMAT',
          label: 'Indian PAN',
          placeholder: 'PAN',
          why: 'Value matches the structure of an Indian PAN.',
        }),
      )
    }
    return out
  },
}

// ---------- UK NINO ----------
const NINO_RE = /(?<![A-Za-z0-9])[A-Z]{2} ?\d{2} ?\d{2} ?\d{2} ?[A-D](?![A-Za-z0-9])/g
const NINO_PREFIX_OK = /^[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]$/
const NINO_LABELS = ['nino', 'national insurance', 'ni number', 'ni no']
const NINO_BAD_PREFIX = new Set(['BG', 'GB', 'NK', 'KN', 'TN', 'NT', 'ZZ'])

export const ninoDetector: Detector = {
  id: 'gov.uk-nino',
  version: V11,
  category: 'gov_id',
  description: 'UK National Insurance numbers',
  examples: {
    positive: ['NINO AB123456C', 'ni number: AB 12 34 56 C'],
    negative: ['BG123456C', 'DA123456C', 'AB123456E', 'ab123456c'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(NINO_RE, text)) {
      const prefix = m[0].slice(0, 2)
      if (!NINO_PREFIX_OK.test(prefix) || NINO_BAD_PREFIX.has(prefix)) {
        if (hasWholeLabelBefore(text, m.index, NINO_LABELS, 30)) {
          out.push(govFailed({ id: 'gov.uk-nino', start: m.index, end: m.index + m[0].length, label: 'UK National Insurance number', placeholder: 'NINO' }))
        }
        continue
      }
      const labeled = hasLabelBefore(text, m.index, NINO_LABELS, 30)
      out.push(
        gov({
          id: 'gov.uk-nino',
          version: V11,
          start: m.index,
          end: m.index + m[0].length,
          confidence: labeled ? 0.9 : 0.75,
          reason: 'NINO_FORMAT',
          label: 'UK National Insurance number',
          placeholder: 'NINO',
          why: 'Value matches the structure of a UK National Insurance number.',
        }),
      )
    }
    return out
  },
}

// ---------- Passport (label only) ----------
const PASSPORT_RE = /(?<![A-Za-z0-9])[A-Z0-9]{6,9}(?![A-Za-z0-9])/g

export const passportDetector: Detector = {
  id: 'gov.passport',
  version: V,
  category: 'gov_id',
  description: 'Passport numbers (label context required)',
  examples: {
    positive: ['passport number: K1234567', 'Passport No. 123456789'],
    negative: ['K1234567 alone', 'passport policy applies', 'passport PASSPORT'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(PASSPORT_RE, text)) {
      if (!/\d/.test(m[0]) || !hasLabelBefore(text, m.index, ['passport'], 30)) continue
      out.push(
        gov({
          id: 'gov.passport',
          start: m.index,
          end: m.index + m[0].length,
          confidence: 0.6,
          reason: 'LABEL_CONTEXT',
          label: 'Passport number',
          placeholder: 'PASSPORT',
          why: 'An alphanumeric code follows a passport label.',
        }),
      )
    }
    return out
  },
}

export const GOV_DETECTORS: Detector[] = [ssnDetector, aadhaarDetector, panDetector, ninoDetector, passportDetector]
