import { describe, expect, it } from 'vitest'
import { bip39Detector, CRYPTO_DETECTORS, ethPrivateKeyDetector } from './crypto'
import { describeExamples } from './testing'
import { fake, HEX } from './helpers'

describeExamples(CRYPTO_DETECTORS)

describe('bip39', () => {
  const valid = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  const invalid = 'abandon '.repeat(11) + 'abandon'

  it('checksum-valid mnemonic scores 0.97 with exact span', () => {
    const text = `my seed: ${valid}.`
    const [f] = bip39Detector.detect({ text })
    expect(text.slice(f.startOffset, f.endOffset)).toBe(valid)
    expect(f.confidence).toBe(0.97)
    expect(f.severity).toBe('critical')
    expect(f.placeholderType).toBe('SEED_PHRASE')
  })

  it('in-list words with a bad checksum score 0.75', () => {
    const [f] = bip39Detector.detect({ text: invalid })
    expect(f.confidence).toBe(0.75)
  })

  it('24 word phrase on newlines is found as one span', () => {
    const text = [...Array(23).fill('zoo'), 'vote'].join('\n')
    const found = bip39Detector.detect({ text })
    expect(found).toHaveLength(1)
    expect(found[0].startOffset).toBe(0)
    expect(found[0].endOffset).toBe(text.length)
  })

  it('ignores 11 words; uppercase text is matched case-insensitively', () => {
    expect(bip39Detector.detect({ text: 'abandon '.repeat(11).trim() })).toEqual([])
    expect(bip39Detector.detect({ text: valid.toUpperCase() })).toHaveLength(1)
  })
})

describe('eth private key', () => {
  it('requires a label and spans the 0x value', () => {
    const key = '0x' + fake(64, 5, HEX)
    const text = `private key: ${key}`
    const [f] = ethPrivateKeyDetector.detect({ text })
    expect(text.slice(f.startOffset, f.endOffset)).toBe(key)
    expect(f.confidence).toBe(0.8)
    expect(f.placeholderType).toBe('WALLET_KEY')
    expect(ethPrivateKeyDetector.detect({ text: key })).toEqual([])
  })
})
