import { describe, expect, it } from 'vitest'
import { parsePolicy } from './parse'
import { STRICT_POLICY } from './presets'

const customRule = {
  id: 'r1',
  name: 'Rule',
  kind: 'keyword' as const,
  pattern: 'x',
  caseSensitive: false,
  severity: 'low' as const,
  placeholderType: 'X',
  enabled: true,
}

describe('parsePolicy', () => {
  it('accepts a valid policy', () => {
    expect(parsePolicy(STRICT_POLICY).ok).toBe(true)
  })

  it('rejects non-objects', () => {
    const r = parsePolicy(null)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('POLICY_INVALID')
  })

  it('summarizes issue paths only, without values', () => {
    const r = parsePolicy({ ...STRICT_POLICY, mode: 'SECRET-VALUE-XYZ' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.message).toContain('mode')
      expect(r.error.message).not.toContain('SECRET-VALUE-XYZ')
    }
  })

  it('rejects duplicate category rules', () => {
    const rules = [...STRICT_POLICY.rules, STRICT_POLICY.rules[0]]
    const r = parsePolicy({ ...STRICT_POLICY, rules })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.message).toMatch(/duplicate category/)
  })

  it('rejects duplicate custom rule ids', () => {
    const r = parsePolicy({ ...STRICT_POLICY, customRules: [customRule, customRule] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.message).toMatch(/custom rule ids/)
  })
})

describe('secret safety floor', () => {
  it.each(['credential', 'cloud_credential', 'private_key', 'crypto_seed', 'db_connection'] as const)(
    'rejects a policy that does not mandatorily redact/block %s',
    (cat) => {
      const relaxed = { ...STRICT_POLICY, rules: STRICT_POLICY.rules.map((r) => (r.category === cat ? { ...r, action: 'warn' as const } : r)) }
      expect(parsePolicy(relaxed).ok).toBe(false)
      const optional = { ...STRICT_POLICY, rules: STRICT_POLICY.rules.map((r) => (r.category === cat ? { ...r, mandatory: false } : r)) }
      expect(parsePolicy(optional).ok).toBe(false)
      const missing = { ...STRICT_POLICY, rules: STRICT_POLICY.rules.filter((r) => r.category !== cat) }
      expect(parsePolicy(missing).ok).toBe(false)
    },
  )
})
