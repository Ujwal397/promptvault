/**
 * Signs a policy JSON into a PolicyBundle (tooling only; never prints private key material).
 *   tsx scripts/sign-policy.ts --gen [--key-id k1]
 *   tsx scripts/sign-policy.ts <policy.json> --key <private.jwk.json> --key-id k1 --issuer acme --sequence 1 [--out bundle.json]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { signPolicyBundle } from '../src/core/policy/bundle'
import { parsePolicy } from '../src/core/policy/parse'

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' } as const

function die(msg: string): never {
  console.error(msg)
  process.exit(1)
}

async function gen(): Promise<void> {
  const keyId = flag('key-id') ?? 'key-1'
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(keyId)) die('Invalid --key-id.')
  const pair = await crypto.subtle.generateKey(ECDSA, true, ['sign', 'verify'])
  const priv = await crypto.subtle.exportKey('jwk', pair.privateKey)
  const pub = await crypto.subtle.exportKey('jwk', pair.publicKey)
  mkdirSync('keys', { recursive: true })
  const file = `keys/${keyId}.private.jwk.json`
  writeFileSync(file, JSON.stringify(priv), { mode: 0o600, flag: 'wx' })
  console.log(`Private key written to ${file} (git-ignored). Trusted public key for "${keyId}":`)
  console.log(JSON.stringify({ [keyId]: pub }, null, 2))
}

async function sign(): Promise<void> {
  const policyPath = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'))
  const keyPath = flag('key')
  const keyId = flag('key-id')
  if (!policyPath || !keyPath || !keyId) {
    die('Usage: sign-policy.ts <policy.json> --key <private.jwk.json> --key-id <id> [--issuer x] [--sequence n] [--out file]')
  }
  const parsed = parsePolicy(JSON.parse(readFileSync(policyPath, 'utf8')))
  if (!parsed.ok) die(`Refusing to sign: ${parsed.error.message}`)
  const sequence = Number(flag('sequence') ?? '1')
  if (!Number.isSafeInteger(sequence) || sequence < 0) die('Invalid --sequence.')
  const jwk = JSON.parse(readFileSync(keyPath, 'utf8')) as JsonWebKey
  const key = await crypto.subtle.importKey('jwk', jwk, ECDSA, false, ['sign'])
  const bundle = await signPolicyBundle(parsed.policy, key, {
    issuedAt: new Date().toISOString(),
    issuer: flag('issuer') ?? 'unknown',
    sequence,
    keyId,
  })
  const out = JSON.stringify(bundle, null, 2)
  const outPath = flag('out')
  if (outPath) writeFileSync(outPath, out)
  else console.log(out)
}

try {
  await (args.includes('--gen') ? gen() : sign())
} catch (e) {
  // Fixed message: parser errors can echo fragments of the key file.
  void e
  die('sign-policy failed: check the policy and key file paths and formats.')
}
