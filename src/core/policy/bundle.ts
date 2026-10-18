/**
 * Signed policy bundles (PRD §10.3 "malicious rule/config update", FR-024/025).
 * ECDSA P-256 / SHA-256 over the canonical-JSON payload. Uses only web-standard `crypto.subtle`.
 * Verification never falls back to a more permissive policy: any failure yields POLICY_INVALID.
 */
import type { EngineError, Policy } from '../types'
import { parsePolicy } from './parse'

export interface PolicyBundle {
  /** Canonical JSON of { policy, issuedAt, issuer, sequence }. */
  payload: string
  /** base64url ECDSA P-256 SHA-256 signature (IEEE P1363 r||s). */
  signature: string
  keyId: string
}

export interface BundleMeta {
  issuedAt: string // ISO 8601
  issuer: string
  sequence: number
  keyId: string
}

export interface VerifyOptions {
  /** Required: reject bundles with a lower sequence (rollback protection). Persist the highest accepted value. */
  minSequence: number
  now?: () => Date
  /** Required: reject bundles older than this many days. */
  maxAgeDays: number
}

export type VerifyResult = { ok: true; policy: Policy; sequence: number } | { ok: false; error: EngineError }

const ALGO = { name: 'ECDSA', hash: 'SHA-256' } as const
const KEY_ALGO = { name: 'ECDSA', namedCurve: 'P-256' } as const
const DAY_MS = 86_400_000
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

const reject = (message: string): VerifyResult => ({ ok: false, error: { code: 'POLICY_INVALID', message } })

/** Deterministic JSON: object keys sorted recursively. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const body = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    return `{${body.join(',')}}`
  }
  return JSON.stringify(value)
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(bin, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

/** Tooling and tests only: production clients hold public keys, never a signing key. */
export async function signPolicyBundle(policy: Policy, privateKey: CryptoKey, meta: BundleMeta): Promise<PolicyBundle> {
  const payload = canonicalJson({ policy, issuedAt: meta.issuedAt, issuer: meta.issuer, sequence: meta.sequence })
  const sig = await crypto.subtle.sign(ALGO, privateKey, new TextEncoder().encode(payload))
  return { payload, signature: toBase64Url(new Uint8Array(sig)), keyId: meta.keyId }
}

async function signatureValid(bundle: PolicyBundle, jwk: JsonWebKey): Promise<boolean> {
  const sig = fromBase64Url(bundle.signature)
  if (!sig) return false
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, KEY_ALGO, false, ['verify'])
    return await crypto.subtle.verify(ALGO, key, sig as BufferSource, new TextEncoder().encode(bundle.payload))
  } catch {
    return false
  }
}

interface Payload {
  policy: unknown
  issuedAt: string
  sequence: number
}

function parsePayload(text: string): Payload | null {
  try {
    const p: unknown = JSON.parse(text)
    if (!p || typeof p !== 'object') return null
    const o = p as Record<string, unknown>
    if (typeof o.issuedAt !== 'string' || typeof o.issuer !== 'string') return null
    if (typeof o.sequence !== 'number' || !Number.isSafeInteger(o.sequence) || o.sequence < 0) return null
    return { policy: o.policy, issuedAt: o.issuedAt, sequence: o.sequence }
  } catch {
    return null
  }
}

export async function verifyPolicyBundle(
  bundle: PolicyBundle,
  trustedKeys: Record<string, JsonWebKey>,
  opts: VerifyOptions,
): Promise<VerifyResult> {
  if (!bundle || typeof bundle.payload !== 'string' || typeof bundle.signature !== 'string' || typeof bundle.keyId !== 'string') {
    return reject('Policy bundle is malformed.')
  }
  const jwk = Object.hasOwn(trustedKeys, bundle.keyId) ? trustedKeys[bundle.keyId] : undefined
  if (!jwk) return reject('Policy bundle is signed by an unknown key.')
  if (!(await signatureValid(bundle, jwk))) return reject('Policy bundle signature is invalid.')

  const payload = parsePayload(bundle.payload)
  if (!payload) return reject('Policy bundle payload is invalid.')
  if (!Number.isInteger(opts.minSequence) || !(opts.maxAgeDays > 0)) {
    return reject('Policy bundle verification requires minSequence and maxAgeDays.')
  }
  if (payload.sequence < opts.minSequence) {
    return reject('Policy bundle is older than the installed policy (rollback rejected).')
  }
  const issued = Date.parse(payload.issuedAt)
  const now = (opts.now ?? (() => new Date()))().getTime()
  if (!Number.isFinite(issued) || issued > now + MAX_CLOCK_SKEW_MS) {
    return reject('Policy bundle has an invalid or future issue date.')
  }
  if (now - issued > opts.maxAgeDays * DAY_MS) return reject('Policy bundle has expired.')
  const parsed = parsePolicy(payload.policy)
  if (!parsed.ok) return { ok: false, error: parsed.error }
  return { ok: true, policy: parsed.policy, sequence: payload.sequence }
}
