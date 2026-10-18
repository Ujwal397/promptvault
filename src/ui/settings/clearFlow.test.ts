import { describe, expect, it } from 'vitest'
import { clearReducer, clearedSummary, type ClearState } from './clearFlow'

describe('clearReducer', () => {
  it('asks, then cancels back to idle without clearing anything', () => {
    const asked = clearReducer({ phase: 'idle' }, { type: 'ask' })
    expect(asked).toEqual({ phase: 'confirming' })
    expect(clearReducer(asked, { type: 'cancel' })).toEqual({ phase: 'idle' })
  })

  it('moves from confirming to clearing with the count, then to cleared once recording is off', () => {
    const clearing = clearReducer({ phase: 'confirming' }, { type: 'confirm', recordsRemoved: 4 })
    expect(clearing).toEqual({ phase: 'clearing', recordsRemoved: 4 })
    expect(clearReducer(clearing, { type: 'recordingOff' })).toEqual({ phase: 'cleared', recordsRemoved: 4 })
  })

  it('ignores confirm unless the user was asked first', () => {
    const idle: ClearState = { phase: 'idle' }
    expect(clearReducer(idle, { type: 'confirm', recordsRemoved: 2 })).toBe(idle)
  })

  it('ignores recordingOff outside the clearing step', () => {
    const idle: ClearState = { phase: 'idle' }
    expect(clearReducer(idle, { type: 'recordingOff' })).toBe(idle)
  })
})

describe('clearedSummary', () => {
  it('says what was removed, with the record count', () => {
    expect(clearedSummary(3)).toEqual([
      'Saved policy removed. The policy is back to Strict.',
      'Settings removed. Placeholder style is back to Labelled.',
      '3 activity records removed.',
      'Record activity is off.',
    ])
  })

  it('uses the singular for one record and still reports zero', () => {
    expect(clearedSummary(1)).toContain('1 activity record removed.')
    expect(clearedSummary(0)).toContain('0 activity records removed.')
  })
})
