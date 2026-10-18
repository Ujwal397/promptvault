/**
 * Public keys that may sign policy bundles, as JWKs keyed by keyId (ECDSA P-256, public halves only).
 *
 * An organisation configures its public key here, under the keyId its bundles carry, and rebuilds the app.
 * Only public keys belong in this file. A private key must never be committed.
 *
 * It is empty by default, so no signed policy can be imported. Imports are then refused with
 * "No trusted signing key is configured", and nothing falls back to loading an unsigned policy.
 */
export const TRUSTED_POLICY_KEYS: Record<string, JsonWebKey> = {}
