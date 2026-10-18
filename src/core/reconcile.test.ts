import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { reconcile } from './reconcile'
import type { Category, RawFinding, Severity } from './types'

function raw(over: Partial<RawFinding> & { startOffset: number; endOffset: number }): RawFinding {
  return {
    category: 'email',
    severity: 'medium',
    confidence: 0.9,
    detectorId: 'd.a',
    detectorVersion: '1.0.0',
    reasonCode: 'X',
    recommendedAction: 'redact',
    label: 'l',
    explanation: 'e',
    placeholderType: 'T',
    source: 'deterministic',
    ...over,
  }
}

describe('reconcile', () => {
  it('assigns sequential ids in start order', () => {
    const r = reconcile([raw({ startOffset: 20, endOffset: 25 }), raw({ startOffset: 0, endOffset: 5 })], 100)
    expect(r.map((f) => [f.findingId, f.startOffset])).toEqual([
      ['f-0', 0],
      ['f-1', 20],
    ])
  })

  it('dedupes identical spans and records the loser', () => {
    const r = reconcile(
      [
        raw({ startOffset: 0, endOffset: 5, detectorId: 'd.b' }),
        raw({ startOffset: 0, endOffset: 5, detectorId: 'd.a' }),
      ],
      100,
    )
    expect(r).toHaveLength(1)
    expect(r[0].detectorId).toBe('d.a')
    expect(r[0].mergedDetectorIds).toEqual(['d.b'])
  })

  it('higher severity beats higher confidence', () => {
    const r = reconcile(
      [
        raw({ startOffset: 0, endOffset: 10, severity: 'high', confidence: 0.5, detectorId: 'hi' }),
        raw({ startOffset: 2, endOffset: 6, severity: 'medium', confidence: 0.99, detectorId: 'lo' }),
      ],
      100,
    )
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ detectorId: 'hi', mergedDetectorIds: ['lo'] })
  })

  it('then confidence, then length, then detectorId', () => {
    const conf = reconcile(
      [
        raw({ startOffset: 0, endOffset: 4, confidence: 0.6, detectorId: 'a' }),
        raw({ startOffset: 2, endOffset: 8, confidence: 0.8, detectorId: 'b' }),
      ],
      10,
    )
    expect(conf[0].detectorId).toBe('b')
    const len = reconcile(
      [raw({ startOffset: 0, endOffset: 4, detectorId: 'a' }), raw({ startOffset: 2, endOffset: 9, detectorId: 'b' })],
      10,
    )
    expect(len[0].detectorId).toBe('b')
    const id = reconcile(
      [raw({ startOffset: 0, endOffset: 4, detectorId: 'z' }), raw({ startOffset: 0, endOffset: 4, detectorId: 'm' })],
      10,
    )
    expect(id[0].detectorId).toBe('m')
  })

  it('obfuscation neither suppresses nor is suppressed', () => {
    const r = reconcile(
      [
        raw({ startOffset: 0, endOffset: 10, severity: 'critical' }),
        raw({ startOffset: 3, endOffset: 5, category: 'obfuscation', severity: 'low', detectorId: 'normalize.invisible-chars' }),
      ],
      10,
    )
    expect(r.map((f) => f.category).sort()).toEqual(['email', 'obfuscation'])
  })

  it('is deterministic regardless of input order', () => {
    const input = [
      raw({ startOffset: 0, endOffset: 5, detectorId: 'a' }),
      raw({ startOffset: 3, endOffset: 9, detectorId: 'b' }),
      raw({ startOffset: 12, endOffset: 15, detectorId: 'c' }),
    ]
    expect(reconcile([...input].reverse(), 10)).toEqual(reconcile(input, 10))
  })

  it('does not mutate inputs and honours maxFindings', () => {
    const input = [
      raw({ startOffset: 0, endOffset: 1 }),
      raw({ startOffset: 2, endOffset: 3 }),
      raw({ startOffset: 4, endOffset: 5 }),
    ]
    const copy = structuredClone(input)
    expect(reconcile(input, 2)).toHaveLength(2)
    expect(input).toEqual(copy)
  })

  it('property: non-obfuscation spans never overlap and ids are sequential', () => {
    const cats: Category[] = ['email', 'phone', 'gov_id', 'obfuscation', 'credential']
    const sevs: Severity[] = ['low', 'medium', 'high', 'critical']
    const arb = fc.record({
      s: fc.integer({ min: 0, max: 200 }),
      len: fc.integer({ min: 1, max: 40 }),
      c: fc.constantFrom(...cats),
      v: fc.constantFrom(...sevs),
      conf: fc.double({ min: 0, max: 1, noNaN: true }),
      id: fc.constantFrom('a', 'b', 'c', 'd'),
    })
    fc.assert(
      fc.property(fc.array(arb, { maxLength: 60 }), (items) => {
        const out = reconcile(
          items.map((i) =>
            raw({ startOffset: i.s, endOffset: i.s + i.len, category: i.c, severity: i.v, confidence: i.conf, detectorId: i.id }),
          ),
          500,
        )
        out.forEach((f, idx) => expect(f.findingId).toBe(`f-${idx}`))
        const solid = out.filter((f) => f.category !== 'obfuscation')
        for (let i = 0; i < solid.length; i++) {
          for (let j = i + 1; j < solid.length; j++) {
            expect(solid[i].endOffset <= solid[j].startOffset || solid[j].endOffset <= solid[i].startOffset).toBe(true)
          }
        }
        for (let i = 1; i < out.length; i++) expect(out[i].startOffset).toBeGreaterThanOrEqual(out[i - 1].startOffset)
      }),
    )
  })
})
