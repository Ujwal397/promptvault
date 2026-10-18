import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { sanitize, scan, STRICT_POLICY } from '../index'
import { CATEGORIES, ACTIONS } from '../types'
import { createEventRecorder, createMemoryStore, toEventRecord } from './index'
import type { ScanResult } from '../types'

const AWS = 'AKIA' + 'IOSFODNN7EXAMPLE'
const GH = 'ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'
const EMAIL = 'jane.quirk' + '@example.com'
const DB = 'postgres://admin:' + 'hunter2pass' + '@db.internal.example:5432/app'
const SECRETS = [AWS, GH, EMAIL, DB]

const doScan = (text: string): ScanResult => scan({ requestId: 'r', text, policy: STRICT_POLICY })
// Schema vocabulary (keys and enum words): a sensitive value sharing a 4-char piece with it is not a leak.
const VOCAB = [...CATEGORIES, ...ACTIONS, 'simulation', 'submission', 'completed', 'partial', 'failed', 'critical', 'schemaVersion', 'categoryCounts', 'validationPassed', 'findingCount', 'policyVersion', 'coreVersion', 'riskBand', 'strict', 'permissive', 'none', 'low', 'medium', 'high'].join(' ')
const day = (iso: string) => () => new Date(iso)

function sanitizeAll(text: string, s: ScanResult) {
  return sanitize({
    requestId: 'r',
    sourceText: text,
    findings: s.findings,
    findingIds: s.findings.map((f) => f.findingId),
    placeholderMode: 'typed',
    policy: STRICT_POLICY,
  })
}

describe('event recorder', () => {
  it('is disabled by default', () => {
    const store = createMemoryStore()
    const rec = createEventRecorder({ store })
    rec.record(doScan(`key ${AWS}`), 'submission')
    expect(store.load()).toHaveLength(0)
    expect(rec.summary().total).toBe(0)
  })

  it('records counts and enums only', () => {
    const r = toEventRecord(doScan(`mail ${EMAIL}`), 'simulation', { now: day('2026-10-18T13:45:10Z') })
    expect(r.day).toBe('2026-10-18')
    expect(r.categoryCounts.email).toBe(1)
    expect(r.validationPassed).toBeNull()
    expect(Object.keys(r).sort()).toEqual(
      ['categoryCounts', 'coreVersion', 'day', 'decision', 'findingCount', 'kind', 'policyId', 'policyVersion', 'riskBand', 'schemaVersion', 'status', 'validationPassed'].sort(),
    )
  })

  it('keeps simulation and submission separate and tracks validation pass rate', () => {
    const rec = createEventRecorder({ store: createMemoryStore(), enabled: true })
    const text = `key ${AWS}`
    const s = doScan(text)
    rec.record(s, 'simulation')
    rec.record(s, 'submission', sanitizeAll(text, s))
    rec.record(s, 'submission')
    const sum = rec.summary()
    expect(sum.byKind).toEqual({ simulation: 1, submission: 2 })
    expect(sum.byCategory.simulation.cloud_credential).toBe(1)
    expect(Object.keys(sum.byDecision.simulation)).toEqual([s.policyDecision])
    expect(sum.validationPassRate).toBe(1)
  })

  it('treats far-future records as invalid so they cannot evade retention', () => {
    const store = createMemoryStore()
    createEventRecorder({ store, enabled: true, now: day('2030-01-01T00:00:00Z') }).record(doScan('hello'), 'submission')
    const cur = createEventRecorder({ store, enabled: true, now: day('2026-10-18T00:00:00Z') })
    expect(cur.summary().total).toBe(0)
  })

  it('purges expired records on load and via purgeExpired', () => {
    const store = createMemoryStore()
    createEventRecorder({ store, enabled: true, now: day('2026-01-01T00:00:00Z') }).record(doScan('hello'), 'submission')
    const cur = createEventRecorder({ store, enabled: true, retentionDays: 30, now: day('2026-10-18T00:00:00Z') })
    expect(cur.summary().total).toBe(0)
    expect(store.load()).toHaveLength(1)
    cur.purgeExpired()
    expect(store.load()).toHaveLength(0)
  })

  it('caps retention at 365 days', () => {
    const store = createMemoryStore()
    createEventRecorder({ store, enabled: true, now: day('2026-01-01T00:00:00Z') }).record(doScan('hi'), 'submission')
    const rec = createEventRecorder({ store, retentionDays: 9999, now: day('2026-10-18T00:00:00Z' ) })
    expect(rec.summary().total).toBe(1)
    const late = createEventRecorder({ store, retentionDays: 9999, now: day('2027-06-01T00:00:00Z') })
    expect(late.summary().total).toBe(0)
  })

  it('enforces maxRecords, dropping the oldest', () => {
    const store = createMemoryStore()
    const rec = createEventRecorder({ store, enabled: true, maxRecords: 3 })
    for (let i = 0; i < 7; i++) rec.record(doScan('hello'), 'simulation')
    expect(store.load()).toHaveLength(3)
  })

  it('drops invalid stored data, including extra fields', () => {
    const good = toEventRecord(doScan('hello'), 'submission')
    const store = createMemoryStore([good, { ...good, text: 'leak' }, { nope: 1 }, null, 'x', { ...good, day: 'yesterday' }])
    const rec = createEventRecorder({ store })
    expect(rec.summary().total).toBe(1)
    expect(JSON.parse(rec.export())).toHaveLength(1)
    rec.clear()
    expect(store.load()).toHaveLength(0)
  })

  it('never serializes sensitive values or offsets (property)', () => {
    const filler = fc.string({ unit: 'grapheme', maxLength: 30 })
    const parts = fc.array(fc.tuple(filler, fc.constantFrom(...SECRETS)), { minLength: 1, maxLength: 4 })
    fc.assert(
      fc.property(parts, filler, (ps, tail) => {
        const text = ps.map(([f, s]) => `${f} ${s} `).join('') + tail
        const s = doScan(text)
        const json = JSON.stringify(toEventRecord(s, 'submission', { sanitize: sanitizeAll(text, s) }))
        const sensitive = [...ps.map(([, v]) => v), ...s.findings.map((f) => text.slice(f.startOffset, f.endOffset))]
        for (const v of sensitive) {
          for (let i = 0; i + 4 <= v.length; i++) {
            const piece = v.slice(i, i + 4)
            if (VOCAB.includes(piece)) continue
            expect(json.includes(piece), `leaked ${piece.length} chars`).toBe(false)
          }
        }
        expect(json).not.toMatch(/offset/i)
      }),
      { numRuns: 100 },
    )
  })
})
