import { describe, expect, it, vi } from 'vitest'
import { STRICT_POLICY, type ScanResult } from '../../core'
import { createLazyScanClient } from './lazyScanClient'
import type { ScanClient } from './scanClient'

const fakeClient = (): ScanClient => ({
  scan: vi.fn(async (req) => ({ requestId: req.requestId }) as ScanResult),
  sanitize: vi.fn(),
  evaluate: vi.fn(),
  dispose: vi.fn(),
})

const req = { requestId: 'r1', text: 'hello', policy: STRICT_POLICY }

describe('createLazyScanClient', () => {
  it('loads the engine once, on first use, and forwards calls', async () => {
    const inner = fakeClient()
    const loader = vi.fn(async () => ({ createScanClient: () => inner }))
    const client = createLazyScanClient({}, loader)
    expect(loader).not.toHaveBeenCalled()
    await client.scan(req)
    await client.scan({ ...req, requestId: 'r2' })
    expect(loader).toHaveBeenCalledTimes(1)
    expect(inner.scan).toHaveBeenCalledTimes(2)
  })

  it('preload loads the engine and warms the worker with one harmless scan', async () => {
    const inner = fakeClient()
    const loader = vi.fn(async () => ({ createScanClient: () => inner }))
    createLazyScanClient({}, loader).preload()
    await vi.waitFor(() => expect(inner.scan).toHaveBeenCalledTimes(1))
    expect(loader).toHaveBeenCalledTimes(1)
    expect(inner.scan).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'warm-up', text: 'warm up' }))
  })

  it('rejects (never reports clean) when the chunk fails to load, then retries', async () => {
    const inner = fakeClient()
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValue({ createScanClient: () => inner })
    const client = createLazyScanClient({}, loader)
    await expect(client.scan(req)).rejects.toThrow('chunk failed')
    await expect(client.scan(req)).resolves.toMatchObject({ requestId: 'r1' })
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('disposes a client that finishes loading after dispose()', async () => {
    const inner = fakeClient()
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    const loader = vi.fn(async () => {
      await gate
      return { createScanClient: () => inner }
    })
    const client = createLazyScanClient({}, loader)
    client.preload()
    client.dispose()
    release()
    await vi.waitFor(() => expect(inner.dispose).toHaveBeenCalled())
  })
})
