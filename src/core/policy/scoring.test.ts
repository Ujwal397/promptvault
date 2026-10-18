import { describe, expect, it } from 'vitest'
import type { Category, Finding, Severity } from '../types'
import { SCORING_VERSION, computeRisk } from './scoring'

function f(category: Category, severity: Severity, confidence: number, extra: Partial<Finding> = {}): Finding {
  return {
    findingId: 'f-0', category, startOffset: 0, endOffset: 1, severity, confidence,
    detectorId: 'd', detectorVersion: '1.0.0', reasonCode: 'R', recommendedAction: 'redact',
    label: 'l', explanation: 'e', placeholderType: 'X', source: 'deterministic', ...extra,
  }
}

describe('computeRisk', () => {
  it('has a version', () => expect(SCORING_VERSION).toBe('1.0.0'))
  it('none for no findings', () => expect(computeRisk([])).toEqual({ score: 0, band: 'none' }))
  it('band edges', () => {
    expect(computeRisk([f('email', 'low', 1)])).toEqual({ score: 25, band: 'low' })
    expect(computeRisk([f('email', 'critical', 0.29)]).band).toBe('low')
    expect(computeRisk([f('email', 'critical', 0.3)]).band).toBe('medium')
    expect(computeRisk([f('email', 'critical', 0.59)]).band).toBe('medium')
    expect(computeRisk([f('email', 'critical', 0.6)]).band).toBe('high')
    expect(computeRisk([f('email', 'critical', 0.84)]).band).toBe('high')
    expect(computeRisk([f('email', 'critical', 0.85)]).band).toBe('critical')
    expect(computeRisk([f('email', 'critical', 1)])).toEqual({ score: 100, band: 'critical' })
  })
  it('uses the max, not the sum', () => {
    expect(computeRisk([f('email', 'medium', 1), f('phone', 'high', 0.5)]).score).toBe(50)
  })
  it('adds +5 per additional credential-type finding', () => {
    const one = computeRisk([f('credential', 'medium', 1)]).score
    const two = computeRisk([f('credential', 'medium', 1), f('cloud_credential', 'medium', 1)]).score
    expect(two - one).toBe(5)
  })
  it('caps the bonus at 15 and score at 100', () => {
    const many = Array.from({ length: 10 }, () => f('credential', 'medium', 1))
    expect(computeRisk(many).score).toBe(65)
    const db = f('db_connection', 'critical', 1, { sensitiveSubspans: [{ start: 0, end: 1 }] })
    expect(computeRisk([db, ...many]).score).toBe(100)
  })
  it('adds +5 for db_connection with subspans', () => {
    const plain = computeRisk([f('db_connection', 'medium', 1)]).score
    const sub = computeRisk([f('db_connection', 'medium', 1, { sensitiveSubspans: [{ start: 0, end: 1 }] })]).score
    expect(sub - plain).toBe(5)
  })
  it('obfuscation is excluded from max, adds +5 alongside others', () => {
    expect(computeRisk([f('obfuscation', 'critical', 1)]).score).toBe(0)
    expect(computeRisk([f('email', 'medium', 1), f('obfuscation', 'critical', 1)]).score).toBe(55)
  })
})
