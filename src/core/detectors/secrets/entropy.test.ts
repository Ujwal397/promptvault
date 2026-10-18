import { describe, expect, it } from 'vitest'
import { CLOUD_DETECTORS } from './cloud'
import { createEntropyDetector } from './entropy'
import { describeExamples } from './testing'
import { fake } from './helpers'
import { TOKEN_DETECTORS } from './tokens'

const detector = createEntropyDetector([...CLOUD_DETECTORS, ...TOKEN_DETECTORS])

describeExamples([detector])

describe('high entropy', () => {
  it('is capped as supporting evidence', () => {
    const tok = fake(60, 12)
    const text = `blob ${tok} end`
    const [f] = detector.detect({ text })
    expect(text.slice(f.startOffset, f.endOffset)).toBe(tok)
    expect(f.confidence).toBeLessThanOrEqual(0.45)
    expect(f.severity).toBe('medium')
    expect(f.reasonCode).toBe('HIGH_ENTROPY_UNLABELED')
    expect(f.recommendedAction).toBe('review')
    expect(f.placeholderType).toBe('TOKEN')
  })

  it('defers to specific detectors', () => {
    expect(detector.detect({ text: 'ghp_' + fake(36, 20) })).toEqual([])
  })

  it('skips single-class and short strings', () => {
    expect(detector.detect({ text: 'a'.repeat(40) })).toEqual([])
    expect(detector.detect({ text: fake(20, 3) })).toEqual([])
  })
})
