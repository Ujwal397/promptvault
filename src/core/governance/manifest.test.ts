/// <reference types="node" />
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { BUILTIN_DETECTORS } from '../detectors'
import manifestJson from './rules.manifest.json'

interface Entry {
  id: string
  version: string
  owner: string
  changelog: { version: string; date: string; note: string }[]
  fingerprint: string
}
const manifest = manifestJson as Entry[]
const byId = new Map(manifest.map((e) => [e.id, e]))

const fingerprint = (d: (typeof BUILTIN_DETECTORS)[number]): string =>
  createHash('sha256')
    .update(d.detect.toString() + JSON.stringify(d.examples) + d.category)
    .digest('hex')
    .slice(0, 16)

describe('rules manifest', () => {
  it.each(BUILTIN_DETECTORS.map((d) => [d.id, d] as const))('%s is governed', (id, d) => {
    const e = byId.get(id)
    expect(e, `detector ${id} has no manifest entry: run npm run rules:snapshot`).toBeDefined()
    if (!e) return
    expect(e.version, `detector ${id} version differs from manifest: bump + run npm run rules:snapshot`).toBe(d.version)
    expect(e.fingerprint, `detector ${id} changed without a version bump: bump version + run npm run rules:snapshot`).toBe(fingerprint(d))
    expect(e.owner).toBe('security-core')
    expect(e.changelog.some((c) => c.version === d.version)).toBe(true)
  })

  it('has no orphan entries or duplicate ids', () => {
    const live = new Set(BUILTIN_DETECTORS.map((d) => d.id))
    expect(manifest.filter((e) => !live.has(e.id)).map((e) => e.id)).toEqual([])
    expect(byId.size).toBe(manifest.length)
  })
})
