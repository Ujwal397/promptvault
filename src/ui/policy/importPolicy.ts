import { verifyPolicyBundle, type Policy, type PolicyBundle } from '../../core'

/** Bundles issued longer ago than this are rejected. verifyPolicyBundle requires a maximum age. */
export const IMPORT_MAX_AGE_DAYS = 30
/** Real bundles are a few kilobytes, so anything larger is not read at all. */
export const IMPORT_MAX_BYTES = 256 * 1024

export const NO_TRUSTED_KEYS_MESSAGE =
  'No trusted signing key is configured. Signed policies cannot be imported in this build.'

type VerifyOptions = Parameters<typeof verifyPolicyBundle>[2]

export interface ImportContext {
  keys: Record<string, JsonWebKey>
  /** Highest bundle sequence accepted so far. Older bundles are rolled-back copies and are rejected. */
  minSequence: number
  maxAgeDays: number
  now?: () => Date
}

export type ImportOutcome = { ok: true; policy: Policy; sequence: number } | { ok: false; message: string }

const rejected = (message: string): ImportOutcome => ({ ok: false, message })

export function hasTrustedKeys(keys: Record<string, JsonWebKey>): boolean {
  return Object.keys(keys).length > 0
}

/** Null when the file may be read, otherwise the reason it is refused. */
export function checkImportSize(bytes: number): string | null {
  return bytes > IMPORT_MAX_BYTES ? 'This file is too large to be a policy bundle.' : null
}

/** Core message prefix -> text for the user. Anything unlisted falls back to the core message. */
const BUNDLE_MESSAGES: readonly (readonly [prefix: string, text: string])[] = [
  ['Policy bundle is malformed.', 'This file is not a signed policy bundle.'],
  ['Policy bundle is signed by an unknown key.', 'This bundle is signed by a key this app does not trust.'],
  ['Policy bundle signature is invalid.', 'The signature does not match this bundle, so it may have been changed.'],
  ['Policy bundle payload is invalid.', 'The bundle contents are damaged or not in the expected format.'],
  ['Policy bundle verification requires', 'The bundle could not be checked because the import settings are incomplete.'],
  [
    'Policy bundle is older than the installed policy',
    'This bundle is older than the last one imported, so it was refused to prevent a rollback.',
  ],
  ['Policy bundle has an invalid or future issue date.', 'The bundle has an issue date in the future, or no valid date.'],
]

/** Turns a core rejection into a sentence for the user. Known messages get specific copy. */
export function describeImportFailure(coreMessage: string, maxAgeDays: number): string {
  if (coreMessage === 'Policy bundle has expired.') {
    return `This bundle was issued more than ${maxAgeDays} days ago, so it has expired.`
  }
  const known = BUNDLE_MESSAGES.find(([prefix]) => coreMessage.startsWith(prefix))
  return known ? known[1] : `Rejected: ${coreMessage}`
}

/** A plain policy file (such as an export) has rules but no signature. It is named so the user knows why. */
export function isUnsignedPolicy(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'rules' in value && 'policyId' in value && !('payload' in value)
}

/**
 * Verifies a signed bundle given as text. Nothing is ever loaded without a valid signature from a trusted
 * key. With no keys configured every import is refused, before the text is even parsed.
 */
export async function verifyImportText(text: string, ctx: ImportContext): Promise<ImportOutcome> {
  if (!hasTrustedKeys(ctx.keys)) return rejected(NO_TRUSTED_KEYS_MESSAGE)
  let bundle: unknown
  try {
    bundle = JSON.parse(text)
  } catch {
    return rejected('This file is not valid JSON.')
  }
  if (isUnsignedPolicy(bundle)) {
    return rejected('This is an unsigned policy file. Only signed policy bundles can be imported.')
  }
  const options: VerifyOptions = { minSequence: ctx.minSequence, maxAgeDays: ctx.maxAgeDays, now: ctx.now }
  const result = await verifyPolicyBundle(bundle as PolicyBundle, ctx.keys, options)
  if (!result.ok) return rejected(describeImportFailure(result.error.message, ctx.maxAgeDays))
  return { ok: true, policy: result.policy, sequence: result.sequence }
}

/** Reads a chosen file and verifies it. The key check runs first, so every import gets the same answer without keys. */
export async function importPolicyFile(file: Blob, ctx: ImportContext): Promise<ImportOutcome> {
  if (!hasTrustedKeys(ctx.keys)) return rejected(NO_TRUSTED_KEYS_MESSAGE)
  const sizeProblem = checkImportSize(file.size)
  if (sizeProblem) return rejected(sizeProblem)
  let text: string
  try {
    text = await file.text()
  } catch {
    return rejected('The file could not be read.')
  }
  return verifyImportText(text, ctx)
}
