import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText } from './clipboard'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('copyText', () => {
  it('resolves true after the browser accepts the text', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await expect(copyText('[EMAIL_1] hello')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('[EMAIL_1] hello')
  })

  it('resolves false when the browser denies the write', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('denied')) } })
    await expect(copyText('x')).resolves.toBe(false)
  })

  it('resolves false when there is no clipboard at all', async () => {
    vi.stubGlobal('navigator', {})
    await expect(copyText('x')).resolves.toBe(false)
  })
})
