/**
 * Regenerates src/core/governance/rules.manifest.json: `npm run rules:snapshot`.
 * Preserves changelogs, adds "initial" entries for new detectors, drops removed ones, and REFUSES
 * (fails, exit 1) when a detector's fingerprint changed without a version bump.
 *
 * It runs under vitest (vitest.snapshot.config.ts) on purpose: fingerprints hash `detect.toString()`,
 * which depends on the transform, so the snapshot must use the same one as manifest.test.ts.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { BUILTIN_DETECTORS } from '../src/core/detectors'

const FILE = new URL('../src/core/governance/rules.manifest.json', import.meta.url)
const DATE = '2026-10-18'

interface Entry {
  id: string
  version: string
  owner: string
  changelog: { version: string; date: string; note: string }[]
  fingerprint: string
}

const fingerprint = (d: (typeof BUILTIN_DETECTORS)[number]): string =>
  createHash('sha256')
    .update(d.detect.toString() + JSON.stringify(d.examples) + d.category)
    .digest('hex')
    .slice(0, 16)

function loadExisting(): Entry[] {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8')) as Entry[]
  } catch {
    return []
  }
}

it('regenerates the rules manifest', () => {
  const prev = new Map(loadExisting().map((e) => [e.id, e]))
  const bad: string[] = []
  const next: Entry[] = BUILTIN_DETECTORS.map((d) => {
    const fp = fingerprint(d)
    const old = prev.get(d.id)
    if (!old) {
      const changelog = [{ version: d.version, date: DATE, note: 'initial' }]
      return { id: d.id, version: d.version, owner: 'security-core', changelog, fingerprint: fp }
    }
    if (old.fingerprint !== fp && old.version === d.version) {
      bad.push(d.id)
      return old
    }
    const changelog = [...old.changelog]
    if (old.version !== d.version && !changelog.some((c) => c.version === d.version)) {
      changelog.push({ version: d.version, date: DATE, note: 'updated (describe the change here)' })
    }
    return { ...old, version: d.version, changelog, fingerprint: fp }
  }).sort((a, b) => a.id.localeCompare(b.id))

  if (bad.length) {
    throw new Error(
      `rules:snapshot refused: detector(s) changed without a version bump: ${bad.join(', ')}. ` +
        'Bump the detector version field, then re-run npm run rules:snapshot.',
    )
  }
  writeFileSync(FILE, JSON.stringify(next, null, 2) + '\n')
  const removed = [...prev.keys()].filter((id) => !next.some((e) => e.id === id))
  console.log(`rules manifest: ${next.length} detectors${removed.length ? `, removed ${removed.join(', ')}` : ''}`)
})
