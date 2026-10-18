import { describe, expect, it } from 'vitest'
import { SECRET_DETECTORS } from '.'
import { describeExamples } from './testing'

describeExamples(SECRET_DETECTORS)

const NEGATIVES = [
  '123e4567-e89b-12d3-a456-426614174000',
  'commit 9fceb02d0ae598e95dc970b74767f19372d61af8',
  'sha256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'color: #ff00aa; background: #1a2b3c;',
  '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==">',
  'password: ${DB_PASS}',
  'Please reset your password',
  'the token was revoked',
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.',
  'version 1.2.3-beta.4+build.5 and v10.20.30',
  '.btn-primary:hover { background-color: rgba(0, 0, 0, 0.5); margin: 0 auto; }',
  'I would like to go to the park with my friends after school today',
  'The secret to good bread is patience and a hot oven.',
]

describe('combined negatives', () => {
  it.each(NEGATIVES)('no detector fires on: %s', (text) => {
    for (const d of SECRET_DETECTORS) expect(d.detect({ text }), d.id).toEqual([])
  })

  it('detector ids are unique and well-formed', () => {
    const ids = SECRET_DETECTORS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(30)
  })
})

describe('performance', () => {
  const CAP = 100_000
  const inputs: Record<string, string> = {
    begin: '-----BEGIN '.repeat(Math.floor(CAP / 11)),
    beginKey: '-----BEGIN PRIVATE KEY-----'.repeat(Math.floor(CAP / 27)),
    jwt: 'eyJ'.repeat(Math.floor(CAP / 3)),
    jwtDots: 'eyJ' + 'a'.repeat(1500) + '.' + 'b'.repeat(CAP - 1600),
    as: 'a'.repeat(CAP),
    pg: 'postgres://'.repeat(Math.floor(CAP / 11)),
    pgLong: 'postgres://u:' + 'p'.repeat(CAP - 20),
    words: 'abandon ability able about '.repeat(Math.floor(CAP / 27)),
    pw: 'password='.repeat(Math.floor(CAP / 9)),
    mix: 'A1b2+/'.repeat(Math.floor(CAP / 6)),
  }

  it('runs all detectors on pathological 100k inputs in < 1500 ms total', () => {
    const start = performance.now()
    for (const text of Object.values(inputs)) {
      expect(text.length).toBeLessThanOrEqual(CAP)
      for (const d of SECRET_DETECTORS) d.detect({ text })
    }
    expect(performance.now() - start).toBeLessThan(1500)
  })
})

describe('provider tokens', () => {
  it('splits a provider token across a line break', () => {
    const d = SECRET_DETECTORS.find((x) => x.id === 'secret.split-token')!
    const tok = 'sb_' + 'secret_' + 'Abcdefghij1234567890KLMNOPQR'
    const text = 'key: ' + tok.slice(0, 18) + '\n  ' + tok.slice(18)
    expect(d.detect({ text }).length).toBeGreaterThanOrEqual(1)
  })

  it('handles pathological prefix floods in < 1500 ms', () => {
    const CAP = 100_000
    const prefixes = [
      'shp' + 'at_', 'do' + 'p_v1_', 'dp.' + 'st.', 'lin_' + 'api_', 'PMAK' + '-', 'pypi-' + 'AgEIcHlwaS5vcmc', 'dapi',
      'sec' + 'ret_', 'gl' + 'c_', 'ATA' + 'TT3', 'hv' + 's.', '.atlas' + 'v1.', 'sk.' + 'eyJ', 'EA' + 'AA', 'sq0' + 'atp-',
      'CF_API_' + 'TOKEN=', 'sbp_', 'sb_' + 'secret_', 'vercel' + '_', 'fo' + '1_', 'AA' + 'AA', 'AGE-SECRET' + '-KEY-1', '8Q~',
    ]
    const start = performance.now()
    for (const p of prefixes) {
      for (const text of [p.repeat(Math.floor(CAP / p.length)), p + 'a'.repeat(CAP - p.length), (p + 'a1').repeat(Math.floor(CAP / (p.length + 2)))]) {
        for (const d of SECRET_DETECTORS) d.detect({ text })
      }
    }
    expect(performance.now() - start).toBeLessThan(6000)
  })
})
