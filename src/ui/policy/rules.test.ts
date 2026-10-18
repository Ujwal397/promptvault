import { describe, expect, it } from 'vitest'
import { ACTIONS, CATEGORIES, PERMISSIVE_POLICY, SECRET_FLOOR, STRICT_POLICY } from '../../core'
import {
  actionOptionsFor,
  isLockedCategory,
  lockedReason,
  pick,
  RULE_ROWS,
  toAction,
  toLowConfidenceAction,
} from './rules'

describe('RULE_ROWS', () => {
  const categories = RULE_ROWS.map((row) => row.category)

  it('lists each category once and only real categories', () => {
    expect(new Set(categories).size).toBe(categories.length)
    for (const category of categories) expect(CATEGORIES).toContain(category)
  })

  it('shows every safety-floor category, so each locked row is visible', () => {
    for (const category of SECRET_FLOOR) expect(categories).toContain(category)
  })

  it('has a rule for every row in both presets, so no row is left blank', () => {
    for (const policy of [STRICT_POLICY, PERMISSIVE_POLICY]) {
      for (const category of categories) {
        expect(policy.rules.some((rule) => rule.category === category)).toBe(true)
      }
    }
  })

  it('leaves out the advisory obfuscation signal', () => {
    expect(categories).not.toContain('obfuscation')
  })
})

describe('locked rows', () => {
  it('locks exactly the safety-floor categories', () => {
    expect(SECRET_FLOOR.every(isLockedCategory)).toBe(true)
    expect(isLockedCategory('email')).toBe(false)
    expect(isLockedCategory('custom')).toBe(false)
  })

  it('gives each locked action a short reason', () => {
    expect(lockedReason('block')).toBe('Safety floor: always blocked')
    expect(lockedReason('redact')).toBe('Safety floor: always removed')
  })

  it('offers a locked row only its current action', () => {
    const options = actionOptionsFor('credential', 'redact')
    expect(options).toEqual([{ value: 'redact', label: 'Redact' }])
  })

  it('offers every action for an ordinary row', () => {
    expect(actionOptionsFor('email', 'redact').map((option) => option.value)).toEqual([...ACTIONS])
  })

  it('shows the floor action for locked rows in both presets', () => {
    for (const policy of [STRICT_POLICY, PERMISSIVE_POLICY]) {
      for (const category of SECRET_FLOOR) {
        const rule = policy.rules.find((candidate) => candidate.category === category)
        expect(rule?.action === 'redact' || rule?.action === 'block').toBe(true)
      }
    }
  })
})

describe('form value parsing', () => {
  it('returns the option equal to the value, and null for anything else', () => {
    expect(pick(['a', 'b'] as const, 'b')).toBe('b')
    expect(pick(['a', 'b'] as const, 'c')).toBeNull()
    expect(pick(['a', 'b'] as const, '')).toBeNull()
  })

  it('accepts real actions and rejects others', () => {
    expect(toAction('block')).toBe('block')
    expect(toAction('Block')).toBeNull()
    expect(toAction('delete')).toBeNull()
  })

  it('accepts only the low-confidence actions', () => {
    expect(toLowConfidenceAction('review')).toBe('review')
    expect(toLowConfidenceAction('block')).toBeNull()
    expect(toLowConfidenceAction('redact')).toBeNull()
  })
})
