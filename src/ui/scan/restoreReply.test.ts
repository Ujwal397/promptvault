import { describe, expect, it } from 'vitest'
import { makeFinding, makeReplacement } from './scanFixtures'
import { placeholderRows, restoreReply, restoreSummary } from './restoreReply'

// Synthetic values only.
const mapping = { '[EMAIL_1]': 'user@example.com', '[API_1]': 'synthetic-value-0001' }

describe('placeholderRows', () => {
  it('lists each mapped placeholder with its category label, never its value', () => {
    const rows = placeholderRows(
      mapping,
      [makeReplacement('f-0', '[EMAIL_1]', 0, 16), makeReplacement('f-1', '[API_1]', 20, 40)],
      [
        makeFinding({ findingId: 'f-0', startOffset: 0, endOffset: 16, label: 'Email address' }),
        makeFinding({ findingId: 'f-1', startOffset: 20, endOffset: 40, label: 'API key' }),
      ],
    )
    expect(rows).toEqual([
      { placeholder: '[EMAIL_1]', label: 'Email address' },
      { placeholder: '[API_1]', label: 'API key' },
    ])
    expect(JSON.stringify(rows)).not.toContain('user@example.com')
  })

  it('uses a generic label when the finding is unknown', () => {
    const rows = placeholderRows({ '[EMAIL_1]': 'x' }, [], [])
    expect(rows).toEqual([{ placeholder: '[EMAIL_1]', label: 'Redacted value' }])
  })

  it('returns no rows when there is no mapping (mask mode)', () => {
    expect(placeholderRows({}, [], [])).toEqual([])
  })
})

describe('restoreReply', () => {
  it('restores only placeholders the mapping issued', () => {
    const result = restoreReply('Mail [EMAIL_1] about [EMAIL_9].', mapping)
    expect(result.text).toBe('Mail user@example.com about [EMAIL_9].')
    expect(result.restoredCount).toBe(1)
    expect(result.unknownPlaceholders).toEqual(['[EMAIL_9]'])
  })

  it('restores every occurrence of an issued placeholder', () => {
    const result = restoreReply('[API_1] then [API_1]', mapping)
    expect(result.text).toBe('synthetic-value-0001 then synthetic-value-0001')
    expect(result.restoredCount).toBe(2)
  })
})

describe('restoreSummary', () => {
  it('describes a reply with no placeholders', () => {
    expect(restoreSummary(restoreReply('plain text', mapping))).toBe('No placeholders were found in this reply.')
  })

  it('counts restored placeholders with the right plural', () => {
    expect(restoreSummary(restoreReply('[EMAIL_1]', mapping))).toBe('Restored 1 placeholder.')
    expect(restoreSummary(restoreReply('[EMAIL_1] [API_1]', mapping))).toBe('Restored 2 placeholders.')
  })

  it('says when placeholders were left unchanged', () => {
    expect(restoreSummary(restoreReply('[EMAIL_1] [X_7]', mapping))).toBe(
      'Restored 1 placeholder. 1 placeholder was not issued for this prompt and was left as it is.',
    )
  })
})
