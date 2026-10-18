import { beforeAll, describe, expect, it } from 'vitest'
import { canonicalJson, signPolicyBundle, verifyPolicyBundle, type PolicyBundle } from './bundle'
import { STRICT_POLICY } from './presets'
import type { Policy } from '../types'

const meta = { issuedAt: '2026-10-10T00:00:00Z', issuer: 'acme-sec', sequence: 5, keyId: 'k1' }
const NOW = () => new Date('2026-10-18T00:00:00Z')
const OPTS = { minSequence: 0, now: NOW, maxAgeDays: 30 }

async function keypair() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  return { priv: pair.privateKey, pub: await crypto.subtle.exportKey('jwk', pair.publicKey) }
}

let a: Awaited<ReturnType<typeof keypair>>
let b: Awaited<ReturnType<typeof keypair>>
let bundle: PolicyBundle

beforeAll(async () => {
  a = await keypair()
  b = await keypair()
  bundle = await signPolicyBundle(STRICT_POLICY, a.priv, meta)
})

describe('verifyPolicyBundle', () => {
  it('accepts a valid bundle', async () => {
    const r = await verifyPolicyBundle(bundle, { k1: a.pub }, { minSequence: 5, now: NOW, maxAgeDays: 30 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.sequence).toBe(5)
      expect(r.policy.policyId).toBe(STRICT_POLICY.policyId)
    }
  })

  it('rejects a tampered payload', async () => {
    const tampered = { ...bundle, payload: bundle.payload.replace('"strict"', '"permissive"') }
    expect(tampered.payload).not.toBe(bundle.payload)
    const r = await verifyPolicyBundle(tampered, { k1: a.pub }, OPTS)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('POLICY_INVALID')
  })

  it('rejects a tampered or malformed signature', async () => {
    expect((await verifyPolicyBundle({ ...bundle, signature: 'AAAA' }, { k1: a.pub }, OPTS)).ok).toBe(false)
    expect((await verifyPolicyBundle({ ...bundle, signature: '!!!' }, { k1: a.pub }, OPTS)).ok).toBe(false)
  })

  it('rejects the wrong key', async () => {
    expect((await verifyPolicyBundle(bundle, { k1: b.pub }, OPTS)).ok).toBe(false)
  })

  it('rejects an unknown keyId, including prototype names', async () => {
    expect((await verifyPolicyBundle(bundle, { other: a.pub }, OPTS)).ok).toBe(false)
    expect((await verifyPolicyBundle({ ...bundle, keyId: 'toString' }, { k1: a.pub }, OPTS)).ok).toBe(false)
  })

  it('rejects a rollback', async () => {
    const r = await verifyPolicyBundle(bundle, { k1: a.pub }, { ...OPTS, minSequence: 6 })
    expect(r.ok).toBe(false)
  })

  it('rejects an expired bundle', async () => {
    const r = await verifyPolicyBundle(bundle, { k1: a.pub }, { ...OPTS, maxAgeDays: 3 })
    expect(r.ok).toBe(false)
  })

  it('rejects a validly signed policy that violates the secret floor', async () => {
    const weak: Policy = {
      ...STRICT_POLICY,
      rules: STRICT_POLICY.rules.map((r) => (r.category === 'private_key' ? { ...r, action: 'allow', mandatory: false } : r)),
    }
    const signed = await signPolicyBundle(weak, a.priv, meta)
    const r = await verifyPolicyBundle(signed, { k1: a.pub }, OPTS)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('POLICY_INVALID')
  })

  it('rejects a validly signed but non-policy payload', async () => {
    const sig = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      a.priv,
      new TextEncoder().encode('{"policy":1}'),
    )
    const bytes = String.fromCharCode(...new Uint8Array(sig))
    const signature = btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect((await verifyPolicyBundle({ payload: '{"policy":1}', signature, keyId: 'k1' }, { k1: a.pub }, OPTS)).ok).toBe(false)
  })
})

describe('verifyPolicyBundle hardening (security review)', () => {
  it('rejects a future-dated bundle (it would otherwise never expire)', async () => {
    const future = await signPolicyBundle(STRICT_POLICY, a.priv, { ...meta, issuedAt: '2027-01-01T00:00:00Z' })
    expect((await verifyPolicyBundle(future, { k1: a.pub }, OPTS)).ok).toBe(false)
  })

  it('refuses to verify without rollback and expiry options', async () => {
    const opts = { now: NOW } as unknown as typeof OPTS
    expect((await verifyPolicyBundle(bundle, { k1: a.pub }, opts)).ok).toBe(false)
  })
})

describe('canonicalJson', () => {
  it('sorts keys deterministically', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: null } })).toBe('{"a":{"c":null,"d":[2,{"y":2,"z":1}]},"b":1}')
  })
})
