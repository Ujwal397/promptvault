import type { Detector, RawFinding } from '../../types'
import { digitsOf, hasLabelBefore, luhnValid, matchAll } from '../util'
import { gov, govFailed } from './govIds'
import { hasWholeLabelBefore } from './labelFailed'

const V = '1.0.0'
const V11 = '1.1.0'

function emit(
  m: RegExpExecArray,
  id: string,
  confidence: number,
  reason: string,
  label: string,
  placeholder: string,
  why: string,
  version = V,
): RawFinding {
  return gov({ id, start: m.index, end: m.index + m[0].length, confidence, reason, label, placeholder, why, version })
}

function failed(m: RegExpExecArray, id: string, label: string, placeholder: string): RawFinding {
  return govFailed({ id, start: m.index, end: m.index + m[0].length, label, placeholder })
}

// ---------- Canada SIN ----------
const SIN_SPACED = /(?<![\d-])\d{3}[ -]\d{3}[ -]\d{3}(?!\d|-\d)/g
const SIN_BARE = /(?<![\w-])\d{9}(?![\w-])/g
const SIN_LABELS = ['sin', 'social insurance']

function sinValid(d: string): boolean {
  return d.length === 9 && d[0] !== '0' && d[0] !== '8' && luhnValid(d)
}

export const sinDetector: Detector = {
  id: 'gov.ca-sin',
  version: V11,
  category: 'gov_id',
  description: 'Canadian Social Insurance Numbers (Luhn checksum)',
  examples: {
    positive: ['SIN 130 692 544', 'social insurance number: 130-692-544', 'sin 130692544'],
    negative: ['130 692 545', '046 454 286', '830 692 547', 'order 130692544', '130692544 alone'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    const why = 'Nine digits pass the Luhn checksum used by Canadian SINs.'
    for (const m of matchAll(SIN_SPACED, text)) {
      if (sinValid(digitsOf(m[0]))) out.push(emit(m, 'gov.ca-sin', 0.85, 'LUHN_VALID', 'Canadian SIN', 'SIN', why, V11))
      else if (hasWholeLabelBefore(text, m.index, SIN_LABELS, 25)) out.push(failed(m, 'gov.ca-sin', 'Canadian SIN', 'SIN'))
    }
    for (const m of matchAll(SIN_BARE, text)) {
      if (!hasWholeLabelBefore(text, m.index, SIN_LABELS, 25)) continue
      if (sinValid(m[0])) out.push(emit(m, 'gov.ca-sin', 0.75, 'LUHN_LABEL_CONTEXT', 'Canadian SIN', 'SIN', why, V11))
      else out.push(failed(m, 'gov.ca-sin', 'Canadian SIN', 'SIN'))
    }
    return out
  },
}

// ---------- Australia TFN ----------
const TFN_SPACED = /(?<![\d-])(?:\d{3} \d{3} \d{3}|\d{2} \d{3} \d{3})(?!\d|[ -]\d)/g
const TFN_BARE = /(?<![\w-])\d{8,9}(?![\w-])/g
const TFN_LABELS = ['tfn', 'tax file']
const TFN_W9 = [1, 4, 3, 7, 5, 8, 6, 9, 10]
const TFN_W8 = [10, 7, 8, 4, 6, 3, 5, 1]

function tfnValid(d: string): boolean {
  const w = d.length === 9 ? TFN_W9 : d.length === 8 ? TFN_W8 : null
  if (!w) return false
  let sum = 0
  for (let i = 0; i < w.length; i++) sum += (d.charCodeAt(i) - 48) * w[i]
  return sum % 11 === 0
}

export const tfnDetector: Detector = {
  id: 'gov.au-tfn',
  version: V11,
  category: 'gov_id',
  description: 'Australian Tax File Numbers (weighted mod-11 checksum)',
  examples: {
    positive: ['TFN 123 456 782', 'tax file number: 123456782', 'tfn 37 118 629'],
    negative: ['123 456 783', '37 118 628', 'order 123456782', 'tfn 12345'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    const why = 'Digits pass the weighted mod-11 checksum used by Australian TFNs.'
    for (const m of matchAll(TFN_SPACED, text)) {
      const labeled = hasLabelBefore(text, m.index, TFN_LABELS, 25)
      if (tfnValid(digitsOf(m[0]))) {
        out.push(emit(m, 'gov.au-tfn', labeled ? 0.9 : 0.7, 'TFN_CHECKSUM_VALID', 'Australian TFN', 'TFN', why, V11))
      } else if (hasWholeLabelBefore(text, m.index, TFN_LABELS, 25)) {
        out.push(failed(m, 'gov.au-tfn', 'Australian TFN', 'TFN'))
      }
    }
    for (const m of matchAll(TFN_BARE, text)) {
      if (!hasWholeLabelBefore(text, m.index, TFN_LABELS, 25)) continue
      if (tfnValid(m[0])) out.push(emit(m, 'gov.au-tfn', 0.85, 'TFN_CHECKSUM_LABEL_CONTEXT', 'Australian TFN', 'TFN', why, V11))
      else out.push(failed(m, 'gov.au-tfn', 'Australian TFN', 'TFN'))
    }
    return out
  },
}

// ---------- Brazil CPF ----------
const CPF_FORMATTED = /(?<![\d.-])\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d|-\d)/g
const CPF_BARE = /(?<![\w.-])\d{11}(?![\w.-])/g

function cpfDigit(d: string, len: number): number {
  let sum = 0
  for (let i = 0; i < len; i++) sum += (d.charCodeAt(i) - 48) * (len + 1 - i)
  const r = 11 - (sum % 11)
  return r >= 10 ? 0 : r
}

function cpfValid(d: string): boolean {
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  return cpfDigit(d, 9) === d.charCodeAt(9) - 48 && cpfDigit(d, 10) === d.charCodeAt(10) - 48
}

export const cpfDetector: Detector = {
  id: 'gov.br-cpf',
  version: V11,
  category: 'gov_id',
  description: 'Brazilian CPF numbers (mod-11 check digits)',
  examples: {
    positive: ['CPF 529.982.247-25', 'cpf: 52998224725', 'doc 111.444.777-35'],
    negative: ['529.982.247-26', '111.111.111-11', '000.000.000-00', 'order 52998224725', '529.982.247-250'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    const why = 'Eleven digits pass both mod-11 check digits of a Brazilian CPF.'
    for (const m of matchAll(CPF_FORMATTED, text)) {
      if (cpfValid(digitsOf(m[0]))) out.push(emit(m, 'gov.br-cpf', 0.9, 'CPF_CHECKSUM_VALID', 'Brazilian CPF', 'CPF', why, V11))
      else if (hasWholeLabelBefore(text, m.index, ['cpf'], 20)) out.push(failed(m, 'gov.br-cpf', 'Brazilian CPF', 'CPF'))
    }
    for (const m of matchAll(CPF_BARE, text)) {
      if (!hasWholeLabelBefore(text, m.index, ['cpf'], 20)) continue
      if (cpfValid(m[0])) out.push(emit(m, 'gov.br-cpf', 0.8, 'CPF_CHECKSUM_LABEL_CONTEXT', 'Brazilian CPF', 'CPF', why, V11))
      else out.push(failed(m, 'gov.br-cpf', 'Brazilian CPF', 'CPF'))
    }
    return out
  },
}

// ---------- Singapore NRIC / FIN ----------
const NRIC_RE = /(?<![A-Za-z0-9])([STFGM])(\d{7})([A-Z])(?![A-Za-z0-9])/g
const NRIC_LABELS = ['nric', 'fin', 'identity card']
const NRIC_W = [2, 7, 6, 5, 4, 3, 2]
const NRIC_TABLES: Record<string, string> = {
  S: 'JZIHGFEDCBA',
  T: 'JZIHGFEDCBA',
  F: 'XWUTRQPNMLK',
  G: 'XWUTRQPNMLK',
  M: 'XWUTRQPNJLK',
}
const NRIC_OFFSET: Record<string, number> = { S: 0, T: 4, F: 0, G: 4, M: 3 }

function nricLetter(prefix: string, digits: string): string {
  let sum = NRIC_OFFSET[prefix]
  for (let i = 0; i < 7; i++) sum += (digits.charCodeAt(i) - 48) * NRIC_W[i]
  return NRIC_TABLES[prefix][sum % 11]
}

export const nricDetector: Detector = {
  id: 'gov.sg-nric',
  version: V11,
  category: 'gov_id',
  description: 'Singapore NRIC / FIN (checksum letter)',
  examples: {
    positive: ['NRIC S1234567D', 'fin: G2345678N', 'T0123456G'],
    negative: ['S1234567A', 'G2345678A', 'A1234567D', 'S1234567', 'xS1234567D'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(NRIC_RE, text)) {
      if (nricLetter(m[1], m[2]) !== m[3]) {
        if (hasWholeLabelBefore(text, m.index, NRIC_LABELS, 25)) out.push(failed(m, 'gov.sg-nric', 'Singapore NRIC/FIN', 'NRIC'))
        continue
      }
      const labeled = hasLabelBefore(text, m.index, NRIC_LABELS, 25)
      out.push(
        emit(m, 'gov.sg-nric', labeled ? 0.92 : 0.8, 'NRIC_CHECKSUM_VALID', 'Singapore NRIC/FIN', 'NRIC',
          'Value has the NRIC/FIN structure and a matching checksum letter.', V11),
      )
    }
    return out
  },
}

// ---------- Spain DNI / NIE ----------
const DNI_RE = /(?<![A-Za-z0-9])([XYZ]\d{7}|\d{8})-?([A-Z])(?![A-Za-z0-9])/g
const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE'
const NIE_PREFIX: Record<string, string> = { X: '0', Y: '1', Z: '2' }

function dniLetter(body: string): string {
  const lead = NIE_PREFIX[body[0]]
  const num = lead === undefined ? body : lead + body.slice(1)
  return DNI_LETTERS[Number(num) % 23]
}

export const dniDetector: Detector = {
  id: 'gov.es-dni',
  version: V,
  category: 'gov_id',
  description: 'Spanish DNI / NIE (mod-23 control letter)',
  examples: {
    positive: ['DNI 12345678Z', 'nie: X1234567L', 'id 87654321-X'],
    negative: ['12345678A', 'X1234567A', 'W1234567L', '1234567Z', 'a12345678Z'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(DNI_RE, text)) {
      if (dniLetter(m[1]) !== m[2]) continue
      const labeled = hasLabelBefore(text, m.index, ['dni', 'nie', 'nif'], 25)
      const nie = NIE_PREFIX[m[1][0]] !== undefined
      out.push(
        emit(m, 'gov.es-dni', labeled ? 0.9 : nie ? 0.8 : 0.7, 'DNI_CHECKSUM_VALID', 'Spanish DNI/NIE', 'DNI',
          'Value has the DNI/NIE structure and a matching mod-23 control letter.'),
      )
    }
    return out
  },
}

// ---------- India voter ID (EPIC), label only ----------
const EPIC_RE = /(?<![A-Za-z0-9])[A-Z]{3}\d{7}(?![A-Za-z0-9])/g

export const epicDetector: Detector = {
  id: 'gov.in-voter-id',
  version: V,
  category: 'gov_id',
  description: 'Indian voter ID / EPIC numbers (label context required)',
  examples: {
    positive: ['voter id: ABC1234567', 'EPIC number XYZ7654321'],
    negative: ['ABC1234567 alone', 'voter ABC123456', 'voter id: abc1234567'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(EPIC_RE, text)) {
      if (!hasLabelBefore(text, m.index, ['voter', 'epic'], 30)) continue
      out.push(emit(m, 'gov.in-voter-id', 0.6, 'LABEL_CONTEXT', 'Indian voter ID (EPIC)', 'VOTER_ID',
        'Three letters and seven digits follow a voter ID label.'))
    }
    return out
  },
}

// ---------- US ITIN ----------
const ITIN_DASHED = /(?<![\d-])9\d{2}-(?:5\d|6[0-5]|7\d|8[0-8]|9[0-2]|9[4-9])-\d{4}(?!\d|-\d)/g
const ITIN_BARE = /(?<![\w-])9\d{2}(?:5\d|6[0-5]|7\d|8[0-8]|9[0-2]|9[4-9])\d{4}(?![\w-])/g

export const itinDetector: Detector = {
  id: 'gov.us-itin',
  version: V,
  category: 'gov_id',
  description: 'US Individual Taxpayer Identification Numbers',
  examples: {
    positive: ['ITIN 912-70-1234', 'taxpayer id 987-88-4321', 'itin: 900-94-1234'],
    negative: ['912-69-1234', '912-93-1234', '812-70-1234', 'order 912701234', '912-70-12345'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    const why = 'Digits fall in the IRS-assigned ITIN ranges (leading 9, restricted middle group).'
    for (const m of matchAll(ITIN_DASHED, text)) {
      out.push(emit(m, 'gov.us-itin', 0.85, 'ITIN_FORMAT', 'US ITIN', 'ITIN', why))
    }
    for (const m of matchAll(ITIN_BARE, text)) {
      if (!hasLabelBefore(text, m.index, ['itin', 'taxpayer identification'], 30)) continue
      out.push(emit(m, 'gov.us-itin', 0.7, 'ITIN_LABEL_CONTEXT', 'US ITIN', 'ITIN', why))
    }
    return out
  },
}

// ---------- US driver's licence (label only) ----------
const DL_RE = /(?<![A-Za-z0-9-])[A-Z0-9][A-Z0-9-]{5,16}(?![A-Za-z0-9-])/g
const DL_LABELS = [
  "driver's license", "driver's licence", 'drivers license', 'driver license', 'driver licence',
  'driving licence', 'driving license', 'dl number', 'dl no', 'dl#',
]

export const driversLicenseDetector: Detector = {
  id: 'gov.us-drivers-license',
  version: V,
  category: 'gov_id',
  description: "Driver's licence numbers (label context required)",
  examples: {
    positive: ["driver's license number: D1234567", 'Drivers License No. 123-456-789', 'DL# A12345678'],
    negative: ['D1234567 alone', "driver's license policy applies", "driver's license: DRIVERSLIC"],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(DL_RE, text)) {
      if (!/\d/.test(m[0]) || !hasLabelBefore(text, m.index, DL_LABELS, 40)) continue
      out.push(emit(m, 'gov.us-drivers-license', 0.55, 'LABEL_CONTEXT', "Driver's licence number", 'DRIVERS_LICENSE',
        "An alphanumeric code follows a driver's licence label."))
    }
    return out
  },
}

// ---------- US EIN (label only) ----------
const EIN_RE = /(?<![\d-])\d{2}-\d{7}(?!\d|-\d)/g

export const einDetector: Detector = {
  id: 'gov.us-ein',
  version: V,
  category: 'gov_id',
  description: 'US Employer Identification Numbers (label context required)',
  examples: {
    positive: ['EIN 12-3456789', 'employer identification number: 98-7654321', 'fein: 45-1234567'],
    negative: ['12-3456789 alone', 'order 12-3456789', 'ein 12-34567890'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(EIN_RE, text)) {
      if (!hasLabelBefore(text, m.index, ['ein', 'fein', 'employer identification'], 40)) continue
      out.push(emit(m, 'gov.us-ein', 0.55, 'LABEL_CONTEXT', 'US EIN', 'EIN',
        'Digits in NN-NNNNNNN form follow an employer identification label.'))
    }
    return out
  },
}

export const INTL_GOV_DETECTORS: Detector[] = [
  sinDetector, tfnDetector, cpfDetector, nricDetector, dniDetector,
  epicDetector, itinDetector, driversLicenseDetector, einDetector,
]
