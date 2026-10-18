import { describe, expect, it } from 'vitest'
import { STRICT_POLICY, type Policy } from '../../core'
import { exportFileName, policyJson } from './exportPolicy'

describe('policyJson', () => {
  it('round-trips the policy as readable JSON with a trailing newline', () => {
    const text = policyJson(STRICT_POLICY)
    expect(text.endsWith('\n')).toBe(true)
    expect(JSON.parse(text)).toEqual(STRICT_POLICY)
  })

  it('contains only the policy fields, with no other data', () => {
    expect(Object.keys(JSON.parse(policyJson(STRICT_POLICY)))).toEqual(Object.keys(STRICT_POLICY))
  })
})

describe('exportFileName', () => {
  it('names the file after the policy id', () => {
    expect(exportFileName(STRICT_POLICY)).toBe('promptvault-policy-strict.json')
  })

  it('replaces characters that are unsafe in a file name', () => {
    const odd: Policy = { ...STRICT_POLICY, policyId: 'my policy/../x' }
    expect(exportFileName(odd)).toBe('promptvault-policy-my-policy-x.json')
  })

  it('falls back to a generic name when nothing usable is left', () => {
    expect(exportFileName({ ...STRICT_POLICY, policyId: '!!!' })).toBe('promptvault-policy-policy.json')
  })
})
