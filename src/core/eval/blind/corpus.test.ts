import { describe, expect, it } from 'vitest'
import { BLIND_CORPUS, BLIND_CORPUS_VERSION } from './corpus'

describe('blind corpus structure', () => {
  it('has a version and exactly 40 cases', () => {
    expect(BLIND_CORPUS_VERSION).toBe('1.0.0')
    expect(BLIND_CORPUS).toHaveLength(40)
  })

  it('has unique blind- prefixed ids', () => {
    const ids = BLIND_CORPUS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => id.startsWith('blind-'))).toBe(true)
  })

  it('is entirely heldout', () => {
    expect(BLIND_CORPUS.every((c) => c.split === 'heldout')).toBe(true)
  })

  it('finds every expected value in its text at the stated occurrence', () => {
    for (const c of BLIND_CORPUS) {
      for (const e of c.expected) {
        const occurrence = e.occurrence ?? 1
        let idx = -1
        for (let i = 0; i < occurrence; i++) idx = c.text.indexOf(e.value, idx + 1)
        expect(idx, `${c.id}: ${e.value.slice(0, 20)}`).toBeGreaterThanOrEqual(0)
      }
    }
  })
})
