import { describe, expect, it } from 'vitest'
import type { Detector, RawFinding } from '../../types'
import { PII_DETECTORS } from './index'
import { labeledNameDetector } from './labeledName'
import { cardDetector } from './financial'
import { phoneDetector } from './phone'

const run = (d: Detector, text: string): RawFinding[] => d.detect({ text })
const byId = (id: string): Detector => PII_DETECTORS.find((d) => d.id === id)!
const values = (d: Detector, text: string): string[] => run(d, text).map((f) => text.slice(f.startOffset, f.endOffset))

describe('labeled name word boundaries', () => {
  it.each([
    'client = OpenAI(api_key=key)',
    'customer = CustomerService()',
    'client = MongoClient(uri)',
    'client = Client.create(opts)',
    'employee = Employee.find(1)',
  ])('ignores code identifier: %s', (t) => {
    expect(run(labeledNameDetector, t)).toEqual([])
  })

  it('still finds real labeled names', () => {
    expect(values(labeledNameDetector, 'Customer: Dana Doe, VIP')).toEqual(['Dana Doe'])
    expect(values(labeledNameDetector, 'client = Alice Example')).toEqual(['Alice Example'])
  })
})

describe('card grouping', () => {
  const hex = '00000010  03 00 3e 00 01 00 00 00  40 10 00 00 00 00 00 00'
  it('ignores hex dump lines', () => {
    expect(run(cardDetector, hex)).toEqual([])
    expect(run(cardDetector, '0000 0000 0000 0000 0000')).toEqual([])
  })
  it('rejects mixed separators and odd groupings', () => {
    expect(run(cardDetector, '4111 1111-1111 1111')).toEqual([])
    expect(run(cardDetector, '41 11 11 11 11 11 11 11')).toEqual([])
  })
  it('accepts real groupings', () => {
    expect(run(cardDetector, '4111111111111111')).toHaveLength(1)
    expect(run(cardDetector, '4111-1111-1111-1111')).toHaveLength(1)
    expect(run(cardDetector, '3782 822463 10005')).toHaveLength(1)
    expect(run(cardDetector, '4222 2222 2222 2')).toHaveLength(1)
  })
})

describe('labeled IDs with failed checksum', () => {
  const cases: Array<[string, string]> = [
    ['gov.in-aadhaar', 'Aadhaar: 2345 6789 0123'],
    ['gov.uk-nino', 'NI number: QQ 12 34 56 C'],
    ['gov.us-ssn', 'SSN: 000-12-3456'],
    ['gov.ca-sin', 'SIN: 130 692 545'],
    ['gov.au-tfn', 'TFN 123 456 783'],
    ['gov.br-cpf', 'CPF: 529.982.247-26'],
    ['gov.sg-nric', 'NRIC S1234567E'],
    ['gov.in-pan', 'PAN: ABCDE1234F'],
  ]
  it.each(cases)('%s reports an uncertain finding for "%s"', (id, text) => {
    const out = run(byId(id), text)
    expect(out).toHaveLength(1)
    expect(out[0].confidence).toBe(0.6)
    expect(out[0].reasonCode).toBe('LABELED_FORMAT_CHECKSUM_FAILED')
  })

  const unlabeled: Array<[string, string]> = [
    ['gov.in-aadhaar', 'ref 2345 6789 0123'],
    ['gov.uk-nino', 'QQ 12 34 56 C'],
    ['gov.us-ssn', '000-12-3456'],
    ['gov.ca-sin', '130 692 545'],
    ['gov.au-tfn', '123 456 783'],
    ['gov.br-cpf', '529.982.247-26'],
    ['gov.sg-nric', 'S1234567E'],
    ['gov.in-pan', 'ABCDE1234F'],
    ['gov.ca-sin', 'since 130 692 545'],
  ]
  it.each(unlabeled)('%s stays silent without a label: "%s"', (id, text) => {
    expect(run(byId(id), text)).toEqual([])
  })

  it('valid labeled values keep their normal reason', () => {
    expect(run(byId('gov.uk-nino'), 'NI number: AB 12 34 56 C')[0].reasonCode).toBe('NINO_FORMAT')
    expect(run(byId('gov.uk-nino'), 'NINO AB 12 34 56 C')[0].confidence).toBe(0.9)
  })
})

describe('UK phone numbers', () => {
  it.each(['07700 900456', '07700900456', '020 7946 0018', '(020) 7946 0018', '0161 496 0000'])('matches %s', (n) => {
    const t = `reach me on ${n} today`
    const out = run(phoneDetector, t)
    expect(out).toHaveLength(1)
    expect(t.slice(out[0].startOffset, out[0].endOffset)).toBe(n)
    expect(out[0].confidence).toBe(0.8)
  })
  it.each(['0000 0000', '01/02/2024', '2024-01-15', 'INV-07700900456', '0000 0000 000', '020 0000 0000'])(
    'ignores %s',
    (t) => {
      expect(run(phoneDetector, t)).toEqual([])
    },
  )
  it('keeps Indian 0-prefix handling', () => {
    expect(run(phoneDetector, '098765 43210')).toHaveLength(1)
    expect(run(phoneDetector, 'Tel 98765 43210')).toHaveLength(1)
  })
})

describe('health.condition', () => {
  const d = (): Detector => byId('health.condition')
  it.each([
    'Patient was diagnosed with type 2 diabetes mellitus last year.',
    'History of hypertension and asthma.',
    'The patient suffers from Parkinson’s disease.',
    'Dx: bipolar disorder',
    'Admitted for tuberculosis treatment',
  ])('reports with clinical context: %s', (t) => {
    const out = run(d(), t)
    expect(out.length).toBeGreaterThan(0)
    expect(out[0]).toMatchObject({ category: 'health', severity: 'high', confidence: 0.75, placeholderType: 'CONDITION' })
  })
  it('reports the full condition span', () => {
    const t = 'Diagnosed with Type 2 Diabetes Mellitus.'
    expect(values(d(), t)).toEqual(['Type 2 Diabetes Mellitus'])
  })
  it.each([
    'We found a cancer on our codebase',
    'the depression of 1929 hit hard',
    'our sales are in depression',
    'asthma inhalers market report',
    'Diabetes is a chronic condition that affects how the body processes glucose.',
    'Patient list is empty.\n\nDiabetes is a metabolic disease.',
    'patient notes ' + 'x'.repeat(90) + ' asthma',
  ])('ignores without clinical context: %s', (t) => {
    expect(run(d(), t)).toEqual([])
  })
})
