import { describe, expect, it } from 'vitest'
import { splitTokenDetector } from './splitTokens'
import { CLOUD_DETECTORS } from './cloud'
import { byId, describeExamples } from './testing'

describeExamples([splitTokenDetector])

const KEY = 'AKIAIOSFODNN7EXAMPLE'
const detect = (text: string) => splitTokenDetector.detect({ text })

describe('secret.split-token', () => {
  it('detects an AWS key split by LF, spanning the line break', () => {
    const text = 'key: AKIAIOSFODNN7\nEXAMPLE'
    const [f, ...rest] = detect(text)
    expect(rest).toEqual([])
    expect(text.slice(f.startOffset, f.endOffset)).toBe('AKIAIOSFODNN7\nEXAMPLE')
    expect(f.category).toBe('cloud_credential')
    expect(f.severity).toBe('critical')
    expect(f.placeholderType).toBe('AWS_ACCESS_KEY')
    expect(f.confidence).toBeCloseTo(0.95 * 0.9, 5)
    expect(f.reasonCode).toBe('SPLIT_ACROSS_LINES')
    expect(f.detectorId).toBe('secret.split-token')
    expect(f.detectorVersion).toBe('1.0.1')
    expect(f.mergedDetectorIds).toEqual(['secret.aws-access-key'])
    expect(f.explanation).toContain('split across a line break')
    expect(f.explanation).not.toContain(KEY)
  })

  it('handles CRLF and indentation, including them in the span', () => {
    const text = 'x = "AKIAIOSFODNN7\r\n    EXAMPLE"'
    const [f] = detect(text)
    expect(text.slice(f.startOffset, f.endOffset)).toBe('AKIAIOSFODNN7\r\n    EXAMPLE')
  })

  it('allows up to 8 leading spaces/tabs, not more', () => {
    expect(detect('AKIAIOSFODNN7\n\t\t  EXAMPLE')).toHaveLength(1)
    expect(detect('AKIAIOSFODNN7\n' + ' '.repeat(9) + 'EXAMPLE')).toHaveLength(0)
  })

  it('detects other prefix formats (GitHub token)', () => {
    const tok = 'ghp_' + 'aB3dE5gH7jK9mN1pQ3sT5vW7yZ9bD1fH3jL5'
    const text = `token ${tok.slice(0, 20)}\n${tok.slice(20)}`
    const [f] = detect(text)
    expect(f.placeholderType).toBe('GITHUB_TOKEN')
    expect(text.slice(f.startOffset, f.endOffset)).toBe(`${tok.slice(0, 20)}\n${tok.slice(20)}`)
  })

  it('ignores a key fully on one line (normal detector handles it)', () => {
    expect(detect(`key: ${KEY}\nnext line`)).toEqual([])
    expect(detect(`a\n${KEY}\nb`)).toEqual([])
    expect(byId(CLOUD_DETECTORS, 'secret.aws-access-key').detect({ text: `key: ${KEY}` })).toHaveLength(1)
  })

  it('ignores unrelated identifiers and normal code', () => {
    expect(detect('const userName = 1\nfooBarBaz()')).toEqual([])
    expect(detect('import foo from "bar"\nimport baz from "qux"')).toEqual([])
    expect(detect('function add(a, b) {\n  return a + b\n}')).toEqual([])
    expect(detect('Hello world\nthis is a normal sentence')).toEqual([])
  })

  it('does not fire when the join is not a valid key', () => {
    expect(detect('AKIAIOSFODNN7\nEXAMPLEEXTRA')).toEqual([])
  })

  it('runs on 100k inputs of short lines in < 300 ms', () => {
    const inputs = [
      'AKIA12\n'.repeat(14_285),
      'x\n'.repeat(50_000),
      'const a = foo(bar)\n'.repeat(5_200),
      'ghp_abcdef\r\n  '.repeat(6_000),
      ('a'.repeat(300) + '\n').repeat(330),
    ]
    for (const text of inputs) {
      const t = performance.now()
      detect(text.slice(0, 100_000))
      expect(performance.now() - t).toBeLessThan(300)
    }
  })
})
