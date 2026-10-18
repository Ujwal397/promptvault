import { describe, expect, it } from 'vitest'
import { KEY_DETECTORS, privateKeyDetector, puttyKeyDetector } from './keys'
import { describeExamples } from './testing'

describeExamples(KEY_DETECTORS)

describe('private key spans', () => {
  it('covers BEGIN through END at 0.99', () => {
    const block = '-----BEGIN EC PRIVATE KEY-----\nQUJD\n-----END EC PRIVATE KEY-----'
    const text = `before\n${block}\nafter`
    const [f] = privateKeyDetector.detect({ text })
    expect(text.slice(f.startOffset, f.endOffset)).toBe(block)
    expect(f.confidence).toBe(0.99)
    expect(f.category).toBe('private_key')
    expect(f.placeholderType).toBe('PRIVATE_KEY')
  })

  it('missing END spans to end of text at 0.9', () => {
    const text = 'x -----BEGIN PRIVATE KEY-----\nQUJDREVG'
    const [f] = privateKeyDetector.detect({ text })
    expect(f.endOffset).toBe(text.length)
    expect(f.confidence).toBe(0.9)
  })

  it('extends unterminated spans through the whole base64 block', () => {
    const text = '-----BEGIN PRIVATE KEY-----\n' + 'A'.repeat(50_000)
    const [f] = privateKeyDetector.detect({ text })
    expect(f.endOffset).toBe(text.length)
  })

  it('finds multiple keys', () => {
    const k = '-----BEGIN PRIVATE KEY-----\nQQ==\n-----END PRIVATE KEY-----'
    expect(privateKeyDetector.detect({ text: `${k}\n${k}` })).toHaveLength(2)
  })

  it('PuTTY key ends after Private-MAC', () => {
    const text = 'PuTTY-User-Key-File-2: ssh-rsa\nPrivate-MAC: ' + 'ab'.repeat(20) + '\ntail'
    const [f] = puttyKeyDetector.detect({ text })
    expect(f.endOffset).toBe(text.indexOf('\ntail'))
  })
})
