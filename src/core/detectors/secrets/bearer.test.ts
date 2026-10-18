import { describe, expect, it } from 'vitest'
import { authHeaderDetector, BEARER_DETECTORS, jwtDetector } from './bearer'
import { describeExamples } from './testing'
import { b64url, B64URL, fake } from './helpers'

describeExamples(BEARER_DETECTORS)

describe('jwt', () => {
  const header = b64url('{"alg":"HS256","typ":"JWT"}')
  const payload = b64url('{"sub":"42"}')
  const sig = fake(43, 3, B64URL)

  it('full span and 0.9 confidence when header has alg', () => {
    const jwt = `${header}.${payload}.${sig}`
    const text = `t=${jwt}!`
    const [f] = jwtDetector.detect({ text })
    expect(text.slice(f.startOffset, f.endOffset)).toBe(jwt)
    expect(f.confidence).toBe(0.9)
    expect(f.severity).toBe('high')
  })

  it('0.5 confidence when the header is not JSON with alg', () => {
    const jwt = `${b64url('{"foo":1}')}.${payload}.${sig}`
    expect(jwtDetector.detect({ text: jwt })[0].confidence).toBe(0.5)
    const junk = 'eyJ' + 'zzzzzzzzzzzz.' + payload + '.' + sig
    expect(jwtDetector.detect({ text: junk })[0].confidence).toBe(0.5)
  })
})

describe('auth header', () => {
  it('span is the token only for Bearer', () => {
    const tok = fake(40, 61)
    const text = `Authorization: Bearer ${tok}\nnext`
    const [f] = authHeaderDetector.detect({ text })
    expect(text.slice(f.startOffset, f.endOffset)).toBe(tok)
    expect(f.placeholderType).toBe('BEARER_TOKEN')
    expect(f.confidence).toBe(0.9)
    expect(f.severity).toBe('critical')
  })

  it('Basic uses BASIC_AUTH placeholder', () => {
    const text = '"Authorization": "Basic dXNlcjpodW50ZXIy"'
    const [f] = authHeaderDetector.detect({ text })
    expect(text.slice(f.startOffset, f.endOffset)).toBe('dXNlcjpodW50ZXIy')
    expect(f.placeholderType).toBe('BASIC_AUTH')
  })
})
