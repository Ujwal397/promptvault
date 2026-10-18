import { describe, expect, it } from 'vitest'
import type { Detector } from '../../types'

/** Registers one test per example for each detector: positives yield >=1 own finding, negatives none. */
export function describeExamples(detectors: Detector[]): void {
  for (const d of detectors) {
    describe(`${d.id} examples`, () => {
      d.examples.positive.forEach((text, i) => {
        it(`positive #${i} is detected`, () => {
          const found = d.detect({ text }).filter((f) => f.detectorId === d.id)
          expect(found.length).toBeGreaterThanOrEqual(1)
          for (const f of found) {
            expect(f.category).toBe(d.category)
            expect(f.endOffset).toBeGreaterThan(f.startOffset)
            expect(f.explanation).not.toContain(text.slice(f.startOffset, f.endOffset))
          }
        })
      })
      d.examples.negative.forEach((text, i) => {
        it(`negative #${i} is ignored`, () => {
          expect(d.detect({ text })).toEqual([])
        })
      })
      it('has metadata', () => {
        expect(d.version).toMatch(/^\d+\.\d+\.\d+$/)
        expect(d.examples.positive.length).toBeGreaterThan(0)
        expect(d.examples.negative.length).toBeGreaterThan(0)
      })
    })
  }
}

export function byId(detectors: Detector[], id: string): Detector {
  const d = detectors.find((x) => x.id === id)
  if (!d) throw new Error(`detector not found: ${id}`)
  return d
}
