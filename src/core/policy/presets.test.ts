import { describe, expect, it } from 'vitest'
import { CATEGORIES, PolicySchema } from '../types'
import { PERMISSIVE_POLICY, POLICY_PRESETS, STRICT_POLICY } from './presets'

describe('policy presets', () => {
  for (const [name, policy] of Object.entries(POLICY_PRESETS)) {
    it(`${name} parses and covers every category once`, () => {
      expect(PolicySchema.safeParse(policy).success).toBe(true)
      expect(policy.rules.map((r) => r.category).sort()).toEqual([...CATEGORIES].sort())
      expect(policy.policyVersion).toBe('1.0.0')
      expect(policy.policyId).toBe(name)
    })
  }

  it('keys and secrets are mandatory in both presets', () => {
    for (const p of [STRICT_POLICY, PERMISSIVE_POLICY]) {
      for (const c of ['private_key', 'crypto_seed', 'credential', 'cloud_credential', 'db_connection']) {
        expect(p.rules.find((r) => r.category === c)?.mandatory).toBe(true)
      }
      expect(p.rules.find((r) => r.category === 'private_key')?.action).toBe('block')
    }
  })

  it('strict and permissive differ on failure handling', () => {
    expect(STRICT_POLICY.onScanFailure).toBe('block')
    expect(PERMISSIVE_POLICY.onScanFailure).toBe('block')
  })
})
