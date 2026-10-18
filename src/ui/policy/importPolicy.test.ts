import { beforeAll, describe, expect, it } from 'vitest'
import { signPolicyBundle, STRICT_POLICY, type Policy, type PolicyBundle } from '../../core'
import {
  checkImportSize,
  describeImportFailure,
  importPolicyFile,
  IMPORT_MAX_BYTES,
  isUnsignedPolicy,
  NO_TRUSTED_KEYS_MESSAGE,
  verifyImportText,
  type ImportContext,
} from './importPolicy'

const NOW = new Date('2026-10-18T12:00:00Z')
const ISSUED = '2026-10-18T10:00:00Z'
const DAY_MS = 86_400_000

interface Signer {
  privateKey: CryptoKey
  keys: Record<string, JsonWebKey>
}

let signer: Signer

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  signer = { privateKey: pair.privateKey, keys: { 'test-key': publicJwk } }
})

async function signed(policy: Policy, overrides: { issuedAt?: string; sequence?: number; keyId?: string } = {}): Promise<string> {
  const bundle: PolicyBundle = await signPolicyBundle(policy, signer.privateKey, {
    issuedAt: overrides.issuedAt ?? ISSUED,
    issuer: 'test-org',
    sequence: overrides.sequence ?? 3,
    keyId: overrides.keyId ?? 'test-key',
  })
  return JSON.stringify(bundle)
}

function context(overrides: Partial<ImportContext> = {}): ImportContext {
  return { keys: signer.keys, minSequence: 0, maxAgeDays: 30, now: () => NOW, ...overrides }
}

function relaxCredentials(): Policy {
  return {
    ...STRICT_POLICY,
    rules: STRICT_POLICY.rules.map((rule) => (rule.category === 'credential' ? { ...rule, action: 'warn' as const } : rule)),
  }
}

describe('verifyImportText without a trusted key', () => {
  it('refuses every import, even a correctly signed bundle', async () => {
    const text = await signed(STRICT_POLICY)
    const outcome = await verifyImportText(text, context({ keys: {} }))
    expect(outcome).toEqual({ ok: false, message: NO_TRUSTED_KEYS_MESSAGE })
    expect(NO_TRUSTED_KEYS_MESSAGE).toContain('No trusted signing key is configured')
  })

  it('refuses before the text is parsed, so bad input gets the same answer', async () => {
    const outcome = await verifyImportText('not json at all', context({ keys: {} }))
    expect(outcome).toEqual({ ok: false, message: NO_TRUSTED_KEYS_MESSAGE })
  })

  it('refuses a file from the chooser before reading it', async () => {
    const file = new Blob([await signed(STRICT_POLICY)], { type: 'application/json' })
    const outcome = await importPolicyFile(file, context({ keys: {} }))
    expect(outcome).toEqual({ ok: false, message: NO_TRUSTED_KEYS_MESSAGE })
  })
})

describe('verifyImportText with a trusted key', () => {
  it('accepts a bundle signed by a trusted key and returns its policy and sequence', async () => {
    const outcome = await verifyImportText(await signed(STRICT_POLICY), context())
    expect(outcome).toEqual({ ok: true, policy: STRICT_POLICY, sequence: 3 })
  })

  it('refuses a bundle from a key id that is not trusted', async () => {
    const outcome = await verifyImportText(await signed(STRICT_POLICY, { keyId: 'other-key' }), context())
    expect(outcome).toEqual({ ok: false, message: 'This bundle is signed by a key this app does not trust.' })
  })

  it('refuses a bundle whose payload was changed after signing', async () => {
    const bundle = JSON.parse(await signed(STRICT_POLICY)) as PolicyBundle
    const tampered = { ...bundle, payload: bundle.payload.replace('"Strict"', '"Loose"') }
    expect(tampered.payload).not.toBe(bundle.payload)
    const outcome = await verifyImportText(JSON.stringify(tampered), context())
    expect(outcome).toEqual({
      ok: false,
      message: 'The signature does not match this bundle, so it may have been changed.',
    })
  })

  it('refuses a rolled-back bundle', async () => {
    const outcome = await verifyImportText(await signed(STRICT_POLICY, { sequence: 3 }), context({ minSequence: 4 }))
    expect(outcome.ok).toBe(false)
    expect(!outcome.ok && outcome.message).toMatch(/rollback/)
  })

  it('refuses an expired bundle and names the age limit', async () => {
    const issued = new Date(NOW.getTime() - 40 * DAY_MS).toISOString()
    const outcome = await verifyImportText(await signed(STRICT_POLICY, { issuedAt: issued }), context({ maxAgeDays: 30 }))
    expect(outcome).toEqual({ ok: false, message: 'This bundle was issued more than 30 days ago, so it has expired.' })
  })

  it('refuses a bundle dated in the future', async () => {
    const issued = new Date(NOW.getTime() + DAY_MS).toISOString()
    const outcome = await verifyImportText(await signed(STRICT_POLICY, { issuedAt: issued }), context())
    expect(outcome).toEqual({
      ok: false,
      message: 'The bundle has an issue date in the future, or no valid date.',
    })
  })

  it('refuses a signed policy that fails validation, and keeps the reason', async () => {
    const outcome = await verifyImportText(await signed(relaxCredentials()), context())
    expect(outcome.ok).toBe(false)
    expect(!outcome.ok && outcome.message).toMatch(/^Rejected: Policy is invalid/)
  })

  it('refuses text that is not JSON', async () => {
    expect(await verifyImportText('{ not json', context())).toEqual({ ok: false, message: 'This file is not valid JSON.' })
  })

  it('names an unsigned policy file, such as an export, so the user knows why', async () => {
    const outcome = await verifyImportText(JSON.stringify(STRICT_POLICY), context())
    expect(outcome).toEqual({
      ok: false,
      message: 'This is an unsigned policy file. Only signed policy bundles can be imported.',
    })
  })

  it('says a JSON file that is not a bundle is not a signed bundle', async () => {
    expect(await verifyImportText('{"hello":1}', context())).toEqual({
      ok: false,
      message: 'This file is not a signed policy bundle.',
    })
    expect(await verifyImportText('null', context())).toEqual({
      ok: false,
      message: 'This file is not a signed policy bundle.',
    })
  })
})

describe('importPolicyFile', () => {
  it('reads a chosen file and verifies it', async () => {
    const file = new Blob([await signed(STRICT_POLICY)], { type: 'application/json' })
    expect(await importPolicyFile(file, context())).toEqual({ ok: true, policy: STRICT_POLICY, sequence: 3 })
  })

  it('refuses a file over the size limit before reading it', async () => {
    const file = new Blob([new Uint8Array(IMPORT_MAX_BYTES + 1)])
    expect(await importPolicyFile(file, context())).toEqual({
      ok: false,
      message: 'This file is too large to be a policy bundle.',
    })
  })
})

describe('import error mapping', () => {
  it.each([
    ['Policy bundle is malformed.', 'This file is not a signed policy bundle.'],
    ['Policy bundle is signed by an unknown key.', 'This bundle is signed by a key this app does not trust.'],
    ['Policy bundle signature is invalid.', 'The signature does not match this bundle, so it may have been changed.'],
    ['Policy bundle payload is invalid.', 'The bundle contents are damaged or not in the expected format.'],
    [
      'Policy bundle verification requires minSequence and maxAgeDays.',
      'The bundle could not be checked because the import settings are incomplete.',
    ],
    [
      'Policy bundle has an invalid or future issue date.',
      'The bundle has an issue date in the future, or no valid date.',
    ],
  ])('maps "%s" to plain language', (coreMessage, expected) => {
    expect(describeImportFailure(coreMessage, 30)).toBe(expected)
  })

  it('uses the configured age limit in the expiry message', () => {
    expect(describeImportFailure('Policy bundle has expired.', 14)).toBe(
      'This bundle was issued more than 14 days ago, so it has expired.',
    )
  })

  it('explains a rollback without naming the core', () => {
    expect(describeImportFailure('Policy bundle is older than the installed policy (rollback rejected).', 30)).toMatch(
      /older than the last one imported/,
    )
  })

  it('falls back to the core message, marked as rejected, for anything unknown', () => {
    expect(describeImportFailure('Something new went wrong.', 30)).toBe('Rejected: Something new went wrong.')
  })

  it('checks file size against the limit', () => {
    expect(checkImportSize(0)).toBeNull()
    expect(checkImportSize(IMPORT_MAX_BYTES)).toBeNull()
    expect(checkImportSize(IMPORT_MAX_BYTES + 1)).toBe('This file is too large to be a policy bundle.')
  })

  it('recognises a plain policy only when it has rules and no signature', () => {
    expect(isUnsignedPolicy(STRICT_POLICY)).toBe(true)
    expect(isUnsignedPolicy({ payload: '{}', signature: 'x', keyId: 'k', rules: [], policyId: 'x' })).toBe(false)
    expect(isUnsignedPolicy(null)).toBe(false)
  })
})
