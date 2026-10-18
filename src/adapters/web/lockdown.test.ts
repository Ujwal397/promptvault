import { describe, expect, it } from 'vitest'
import { applyLockdown } from './lockdown'

const NAMES = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'WebTransport']

function fakeGlobal(withBeacon = true): Record<string, unknown> {
  const g: Record<string, unknown> = { navigator: withBeacon ? { sendBeacon: () => true } : {} }
  for (const n of NAMES) g[n] = function original() {}
  return g
}

describe('applyLockdown', () => {
  it('replaces every network API with a throwing stub', () => {
    const g = fakeGlobal()
    applyLockdown(g)
    for (const n of NAMES) expect(() => (g[n] as () => void)()).toThrow(/disabled/)
    expect(() => (g.navigator as { sendBeacon: () => void }).sendBeacon()).toThrow(/disabled/)
  })

  it('makes the stubs non-writable and non-configurable', () => {
    const g = fakeGlobal()
    applyLockdown(g)
    for (const n of NAMES) {
      const d = Object.getOwnPropertyDescriptor(g, n)!
      expect(d.writable).toBe(false)
      expect(d.configurable).toBe(false)
      expect(() => Object.defineProperty(g, n, { value: 1 })).toThrow()
    }
  })

  it('skips APIs that do not exist and tolerates a missing navigator', () => {
    const g: Record<string, unknown> = { fetch: () => 1 }
    applyLockdown(g)
    expect('WebSocket' in g).toBe(false)
    expect(() => (g.fetch as () => void)()).toThrow()
    expect(() => applyLockdown({})).not.toThrow()
    const h = fakeGlobal(false)
    applyLockdown(h)
    expect('sendBeacon' in (h.navigator as object)).toBe(false)
  })
})
