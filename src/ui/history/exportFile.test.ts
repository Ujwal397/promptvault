import { describe, expect, it } from 'vitest'
import { historyFileName } from './exportFile'

describe('historyFileName', () => {
  it('dates the export by its UTC day', () => {
    expect(historyFileName(new Date('2026-10-18T13:45:00Z'))).toBe('promptvault-history-2026-10-18.json')
    expect(historyFileName(new Date('2026-10-18T23:30:00Z'))).toBe('promptvault-history-2026-10-18.json')
  })
})
