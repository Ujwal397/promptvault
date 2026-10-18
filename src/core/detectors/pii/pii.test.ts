import { describe, expect, it } from 'vitest'
import type { Detector, RawFinding } from '../../types'
import { PII_DETECTORS } from './index'
import { phoneDetector } from './phone'
import { cardDetector } from './financial'
import { verhoeffAppend, verhoeffValid } from './verhoeff'
import { ipv4Detector } from './ipv4'
import { ssnDetector } from './govIds'

/** Detectors changed after 1.0.0 (see rules.manifest.json). */
const BUMPED = new Set([
  'pii.phone', 'pii.labeled-name', 'fin.card', 'gov.us-ssn', 'gov.in-aadhaar', 'gov.in-pan', 'gov.uk-nino',
  'gov.ca-sin', 'gov.au-tfn', 'gov.br-cpf', 'gov.sg-nric',
])

const run = (d: Detector, text: string): RawFinding[] => d.detect({ text })

describe('PII detector examples', () => {
  it('registers every expected detector id exactly once', () => {
    const ids = PII_DETECTORS.map((d) => d.id).sort()
    expect(ids).toEqual(
      [
        'pii.email', 'pii.phone', 'pii.ipv4', 'pii.ipv6', 'pii.labeled-name', 'gov.us-ssn', 'gov.in-aadhaar', 'gov.in-pan',
        'gov.uk-nino', 'gov.passport',
        'gov.ca-sin', 'gov.au-tfn', 'gov.br-cpf', 'gov.sg-nric', 'gov.es-dni', 'gov.in-voter-id', 'gov.us-itin',
        'gov.us-drivers-license', 'gov.us-ein', 'fin.card', 'fin.iban', 'fin.bank-account', 'health.mrn', 'health.condition',
      ].sort(),
    )
  })

  for (const d of PII_DETECTORS) {
    describe(d.id, () => {
      it('has its expected version and examples', () => {
        expect(d.version).toBe(BUMPED.has(d.id) ? '1.1.0' : '1.0.0')
        expect(d.examples.positive.length).toBeGreaterThan(0)
        expect(d.examples.negative.length).toBeGreaterThan(0)
      })
      for (const ex of d.examples.positive) {
        it(`matches: ${ex}`, () => {
          const out = run(d, ex)
          expect(out.length).toBeGreaterThan(0)
          for (const f of out) {
            expect(f.detectorId).toBe(d.id)
            expect(f.category).toBe(d.category)
            expect(f.startOffset).toBeGreaterThanOrEqual(0)
            expect(f.endOffset).toBeLessThanOrEqual(ex.length)
            expect(f.startOffset).toBeLessThan(f.endOffset)
            expect(f.confidence).toBeGreaterThanOrEqual(0)
            expect(f.confidence).toBeLessThanOrEqual(1)
            const value = ex.slice(f.startOffset, f.endOffset)
            expect(f.explanation).not.toContain(value)
            expect(f.label).not.toContain(value)
          }
        })
      }
      for (const ex of d.examples.negative) {
        it(`ignores: ${ex}`, () => {
          expect(run(d, ex)).toEqual([])
        })
      }
    })
  }
})

describe('pii.phone specifics', () => {
  it('bare digits need a label and score <= 0.5', () => {
    expect(run(phoneDetector, 'order 9876543210')).toEqual([])
    const out = run(phoneDetector, 'call 9876543210')
    expect(out).toHaveLength(1)
    expect(out[0].confidence).toBeLessThanOrEqual(0.5)
  })

  it('ignores dates, versions, timestamps and cards', () => {
    for (const t of ['2024-01-15', '2024-01-15 10:30:00', 'v1.2.3', '4111-1111-1111-1111', '4111111111111111', 'phone 4111111111111111']) {
      expect(run(phoneDetector, t)).toEqual([])
    }
  })

  it('does not treat words containing "tel" as a label', () => {
    expect(run(phoneDetector, 'hotel 9876543210')).toEqual([])
  })

  it('recognises Indian mobile with +91 at higher confidence', () => {
    const out = run(phoneDetector, '+91 98765 43210')
    expect(out[0].confidence).toBeGreaterThanOrEqual(0.9)
  })
})

describe('financial', () => {
  it('card wins over phone for a labelled card number', () => {
    expect(run(cardDetector, 'phone 4111 1111 1111 1111')).toHaveLength(1)
  })
  it('card spans include the separators and exclude surrounding text', () => {
    const t = 'x 4111-1111-1111-1111 y'
    const [f] = run(cardDetector, t)
    expect(t.slice(f.startOffset, f.endOffset)).toBe('4111-1111-1111-1111')
  })
})

describe('gov ids', () => {
  it('ssn dashed is 0.9 and bare needs a label', () => {
    expect(run(ssnDetector, '123-45-6789')[0].confidence).toBe(0.9)
    expect(run(ssnDetector, 'ssn 123456789')[0].confidence).toBeLessThan(0.9)
    expect(run(ssnDetector, 'ref 123456789')).toEqual([])
  })
  it('verhoeff helper round-trips', () => {
    const v = verhoeffAppend('23456789012')
    expect(verhoeffValid(v)).toBe(true)
    expect(verhoeffValid(v.slice(0, 11) + String((Number(v[11]) + 1) % 10))).toBe(false)
  })
})

describe('pii.ipv4', () => {
  it('lowers confidence for private ranges', () => {
    const pub = run(ipv4Detector, 'host 203.0.113.9')[0]
    const priv = run(ipv4Detector, 'host 10.0.0.1')[0]
    expect(priv.confidence).toBeLessThan(pub.confidence)
  })
})

describe('pii.ipv6 structure', () => {
  it('validates full and compressed forms and rejects malformed ones', async () => {
    const { isIpv6 } = await import('./ipv6')
    expect(isIpv6('2001:db8::1')).toBe(true)
    expect(isIpv6('fe80:0:0:0:0:0:0:1')).toBe(true)
    expect(isIpv6('1:2:3:4:5:6:7')).toBe(false)
    expect(isIpv6('1::2::3')).toBe(false)
    expect(isIpv6('12345::1')).toBe(false)
  })
})

describe('international gov id checksums', () => {
  const byId = (id: string): Detector => PII_DETECTORS.find((d) => d.id === id)!
  const cases: Array<[string, string, string]> = [
    ['gov.ca-sin', 'SIN 130 692 544', '130 692 545'],
    ['gov.au-tfn', 'TFN 123 456 782', 'tfn: 123 456 783'],
    ['gov.br-cpf', 'CPF 529.982.247-25', '529.982.247-26'],
    ['gov.sg-nric', 'NRIC S1234567D', 'S1234567E'],
    ['gov.es-dni', 'DNI 12345678Z', 'DNI 12345678A'],
  ]
  it.each(cases)('%s accepts the valid value and rejects one wrong check digit', (id, good, bad) => {
    expect(run(byId(id), good)).toHaveLength(1)
    expect(run(byId(id), bad).filter((f) => f.reasonCode !== 'LABELED_FORMAT_CHECKSUM_FAILED')).toEqual([])
  })

  it('SIN: bare digits need a label; dashed scores 0.85', () => {
    expect(run(byId('gov.ca-sin'), '130692544')).toEqual([])
    expect(run(byId('gov.ca-sin'), '130-692-544')[0].confidence).toBe(0.85)
  })

  it('CPF rejects all-same digits and 8-digit TFN weights work', () => {
    expect(run(byId('gov.br-cpf'), '000.000.000-00')).toEqual([])
    expect(run(byId('gov.au-tfn'), 'tfn 37118629')).toHaveLength(1)
  })

  it('label-only detectors score 0.55-0.6 and ignore unlabeled values', () => {
    expect(run(byId('gov.us-ein'), 'EIN 12-3456789')[0].confidence).toBe(0.55)
    expect(run(byId('gov.us-ein'), '12-3456789')).toEqual([])
    expect(run(byId('gov.in-voter-id'), 'ABC1234567')).toEqual([])
    expect(run(byId('gov.in-voter-id'), 'voter id ABC1234567')[0].confidence).toBe(0.6)
  })

  it('ITIN does not overlap SSN rules', () => {
    expect(run(ssnDetector, '912-70-1234')).toEqual([])
    expect(run(byId('gov.us-itin'), '912-70-1234')).toHaveLength(1)
  })
})
