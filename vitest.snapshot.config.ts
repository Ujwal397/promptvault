import { defineConfig } from 'vitest/config'

// Runs scripts/rules-snapshot.ts under the SAME transform as the tests, so fingerprints match.
export default defineConfig({
  test: { include: ['scripts/rules-snapshot.ts'], environment: 'node', reporters: ['dot'] },
})
