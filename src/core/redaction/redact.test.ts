import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { Finding, Span } from '../types'
import { applyRedactions } from './redact'

function mk(id: string, start: number, end: number, type = 'EMAIL', extra: Partial<Finding> = {}): Finding {
  return {
    findingId: id, category: 'email', startOffset: start, endOffset: end, severity: 'medium', confidence: 1,
    detectorId: 'd', detectorVersion: '1', reasonCode: 'R', recommendedAction: 'redact', label: 'l',
    explanation: 'e', placeholderType: type, source: 'deterministic', ...extra,
  }
}

function span(text: string, value: string, nth = 0): [number, number] {
  let idx = -1
  for (let i = 0; i <= nth; i++) idx = text.indexOf(value, idx + 1)
  return [idx, idx + value.length]
}

function run(text: string, findings: Finding[], mode: 'typed' | 'mask' = 'typed', structured = true) {
  return applyRedactions(text, findings, findings.map((x) => x.findingId), mode, { structured })
}

describe('applyRedactions', () => {
  it('numbers in document order: first email is EMAIL_1', () => {
    const t = 'a@example.com then b@example.com'
    const [a, b] = [span(t, 'a@example.com'), span(t, 'b@example.com')]
    // pass ids in reverse order to prove numbering is by document position
    const fs = [mk('f-0', a[0], a[1]), mk('f-1', b[0], b[1])]
    const r = applyRedactions(t, fs, ['f-1', 'f-0'], 'typed', { structured: true })
    expect(r).toMatchObject({ ok: true, text: '[EMAIL_1] then [EMAIL_2]' })
    if (r.ok) expect(r.mapping).toEqual({ '[EMAIL_1]': 'a@example.com', '[EMAIL_2]': 'b@example.com' })
  })

  it('uses the same placeholder for a repeated value', () => {
    const t = 'x@example.com y@example.com x@example.com'
    const fs = [mk('f-0', 0, 13), mk('f-1', 14, 27), mk('f-2', 28, 41)]
    const r = run(t, fs)
    expect(r).toMatchObject({ ok: true, text: '[EMAIL_1] [EMAIL_2] [EMAIL_1]' })
  })

  it('skips placeholders already present in the source', () => {
    const t = 'see [EMAIL_1] and a@example.com'
    const [s, e] = span(t, 'a@example.com')
    const r = run(t, [mk('f-0', s, e)])
    expect(r).toMatchObject({ ok: true, text: 'see [EMAIL_1] and [EMAIL_2]' })
  })

  it('mask mode uses REDACTED_TYPE and an empty mapping', () => {
    const t = 'a@example.com'
    const r = run(t, [mk('f-0', 0, 13)], 'mask')
    expect(r).toMatchObject({ ok: true, text: '[REDACTED_EMAIL]', mapping: {} })
  })

  it('structured: replaces only the sensitive subspan', () => {
    const t = 'url=postgres://admin:hunter22@db.example.com/app ok'
    const [ps, pe] = span(t, 'hunter22')
    const [s, e] = span(t, 'postgres://admin:hunter22@db.example.com/app')
    const f = mk('f-0', s, e, 'DB_PASSWORD', { category: 'db_connection', sensitiveSubspans: [{ start: ps, end: pe }] })
    const r = run(t, [f])
    expect(r).toMatchObject({ ok: true, text: 'url=postgres://admin:[DB_PASSWORD_SECRET_1]@db.example.com/app ok' })
    const whole = run(t, [f], 'typed', false)
    expect(whole).toMatchObject({ ok: true, text: 'url=[DB_PASSWORD_1] ok' })
  })

  it('preserves line breaks, tabs and indentation', () => {
    const t = 'def f():\r\n\t    mail = "a@example.com"\n\n    return 1\n'
    const [s, e] = span(t, 'a@example.com')
    const r = run(t, [mk('f-0', s, e)])
    expect(r).toMatchObject({ ok: true, text: 'def f():\r\n\t    mail = "[EMAIL_1]"\n\n    return 1\n' })
  })

  it('records replacements with original offsets', () => {
    const r = run('xx a@example.com', [mk('f-0', 3, 16)])
    if (!r.ok) throw new Error('expected ok')
    expect(r.replacements).toEqual([{ findingId: 'f-0', placeholder: '[EMAIL_1]', start: 3, end: 16 }])
  })

  describe('rejections', () => {
    const t = 'abcdefghij'
    const code = 'INVALID_FINDING_RANGE'
    it('overlapping spans', () => {
      const r = run(t, [mk('f-0', 0, 5), mk('f-1', 4, 8)])
      expect(r).toMatchObject({ ok: false, error: { code } })
    })
    it('out of range', () => {
      expect(run(t, [mk('f-0', 5, 11)])).toMatchObject({ ok: false, error: { code } })
      expect(run(t, [mk('f-0', -1, 3)])).toMatchObject({ ok: false, error: { code } })
    })
    it('unknown id', () => {
      const r = applyRedactions(t, [mk('f-0', 0, 3)], ['f-9'], 'typed', { structured: true })
      expect(r).toMatchObject({ ok: false, error: { code } })
    })
    it('start >= end', () => {
      expect(run(t, [mk('f-0', 5, 5)])).toMatchObject({ ok: false, error: { code } })
      expect(run(t, [mk('f-0', 6, 2)])).toMatchObject({ ok: false, error: { code } })
    })
    it('invalid subspan', () => {
      const f = mk('f-0', 0, 5, 'X', { sensitiveSubspans: [{ start: 2, end: 99 }] })
      expect(run(t, [f])).toMatchObject({ ok: false, error: { code } })
    })
    it('error messages never contain the text', () => {
      const r = run('SECRETVALUE', [mk('f-0', 5, 99)])
      if (r.ok) throw new Error('expected failure')
      expect(r.error.message).not.toContain('SECRET')
    })
  })

  it('does not mutate inputs', () => {
    const fs = [mk('f-0', 0, 3)]
    const copy = JSON.stringify(fs)
    run('abcdef', fs)
    expect(JSON.stringify(fs)).toBe(copy)
  })

  describe('properties', () => {
    // Lowercase text so placeholders (uppercase, bracketed) can never contain a value.
    const textArb = fc.string({ unit: fc.constantFrom('a', 'b', 'c', 'd', ' ', '\n', '\t'), maxLength: 80 })
    const spansArb = (len: number) =>
      fc.uniqueArray(fc.integer({ min: 0, max: len }), { minLength: 0, maxLength: 8 }).map((pts) => {
        const sorted = [...pts].sort((x, y) => x - y)
        const spans: Span[] = []
        for (let i = 0; i + 1 < sorted.length; i += 2) {
          spans.push({ start: sorted[i] as number, end: sorted[i + 1] as number })
        }
        return spans
      })
    const caseArb = textArb.chain((text) => spansArb(text.length).map((spans) => ({ text, spans })))

    it('hides selected values, preserves surrounding text, and is deterministic', () => {
      fc.assert(
        fc.property(caseArb, ({ text, spans }) => {
          const findings = spans.map((s, i) => mk(`f-${i}`, s.start, s.end))
          const a = run(text, findings)
          const b = run(text, findings)
          expect(a).toEqual(b)
          if (!a.ok) throw new Error('expected ok')

          const kept: string[] = []
          let cursor = 0
          for (const s of spans) {
            kept.push(text.slice(cursor, s.start))
            cursor = s.end
          }
          kept.push(text.slice(cursor))

          // (2) text between spans is preserved in order
          expect(a.text.split(/\[EMAIL_\d+\]/)).toEqual(kept)

          // (1) selected values (len >= 4) absent unless they occur in kept text
          const keptJoined = kept.join('\u0000')
          for (const s of spans) {
            const v = text.slice(s.start, s.end)
            if (v.length >= 4 && !keptJoined.includes(v)) expect(a.text.includes(v)).toBe(false)
          }
        }),
        { numRuns: 300 },
      )
    })
  })
})
