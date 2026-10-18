import { describe, expect, it } from 'vitest'
import { makeFinding, makeReplacement, makeSanitize, makeScan } from './scanFixtures'
import { copyMessage, replacedCount, replacedPhrase, residualRows, statusCopy } from './sanitizedCopy'
import { sanitizeReadiness } from './readiness'

describe('statusCopy', () => {
  it('says "No risk left" only for a fully validated output with nothing kept', () => {
    const result = makeSanitize({ replacements: [makeReplacement('f-0', '[EMAIL_1]', 0, 5), makeReplacement('f-1', '[API_1]', 9, 12)] })
    expect(statusCopy(result, sanitizeReadiness(result, 0))).toEqual({
      tone: 'ok',
      lead: 'No risk left',
      rest: '2 items replaced · re-scan found nothing left',
    })
  })

  it('does not claim "No risk left" when the user kept something', () => {
    const result = makeSanitize({ replacements: [makeReplacement('f-0', '[EMAIL_1]', 0, 5)] })
    const copy = statusCopy(result, sanitizeReadiness(result, 1))
    expect(copy.lead).not.toBe('No risk left')
    expect(copy).toEqual({ tone: 'kept', lead: '1 item kept as you chose', rest: '1 item replaced · re-scan found nothing else to act on' })
  })

  it('states residual risk honestly when findings remain', () => {
    const result = makeSanitize({ residualFindingIds: ['f-0'], validationPassed: false })
    const copy = statusCopy(result, sanitizeReadiness(result, 0))
    expect(copy).toEqual({ tone: 'bad', lead: 'Residual risk', rest: '1 item still needs action under this policy.' })
  })

  it('says "Not validated" when there are no residuals but the output did not validate', () => {
    const result = makeSanitize({ validationPassed: false })
    expect(statusCopy(result, sanitizeReadiness(result, 0)).lead).toBe('Not validated')
  })

  it('never reads as clean when the re-scan did not finish', () => {
    const result = makeSanitize({ postScan: makeScan({ status: 'failed' }), validationPassed: false })
    const copy = statusCopy(result, sanitizeReadiness(result, 0))
    expect(copy.tone).toBe('bad')
    expect(copy.lead).not.toMatch(/No risk left/)
  })
})

describe('replacedPhrase', () => {
  it('uses the right wording for zero, one and many', () => {
    expect(replacedPhrase(0)).toBe('Nothing was replaced')
    expect(replacedPhrase(1)).toBe('1 item replaced')
    expect(replacedPhrase(3)).toBe('3 items replaced')
  })
})

describe('replacedCount', () => {
  it('counts findings, not replacements (a structured finding can have several)', () => {
    const result = makeSanitize({
      replacements: [makeReplacement('f-0', '[DB_1]', 0, 3), makeReplacement('f-0', '[DB_SECRET_1]', 4, 9)],
    })
    expect(replacedCount(result)).toBe(1)
  })
})

describe('copyMessage', () => {
  const ready = sanitizeReadiness(makeSanitize(), 0)
  const blocked = sanitizeReadiness(makeSanitize({ validationPassed: false }), 0)

  it('explains why Copy is off, with the reason', () => {
    expect(copyMessage('idle', blocked)).toBe(`Copy is off. ${blocked.ready ? '' : blocked.reason}`)
    expect(copyMessage('idle', ready)).toBe('')
  })

  it('confirms a copy and says the copy keeps the real placeholders', () => {
    expect(copyMessage('copied', ready)).toMatch(/^Copied to the clipboard\. .*\[EMAIL_1\]/)
  })

  it('says when the browser blocked the copy', () => {
    expect(copyMessage('failed', ready)).toMatch(/blocked copying, so nothing was copied/)
  })
})

describe('residualRows', () => {
  it('looks up residual ids in the re-scan and masks the text it covers', () => {
    const sanitizedText = 'Contact [EMAIL_1] or leftover-value-42 now'
    const result = makeSanitize({
      sanitizedText,
      residualFindingIds: ['f-0'],
      validationPassed: false,
      postScan: makeScan({
        findings: [makeFinding({ findingId: 'f-0', startOffset: 21, endOffset: 38, label: 'Leftover value' })],
      }),
    })
    expect(residualRows(result)).toEqual([{ key: 'f-0', label: 'Leftover value', masked: 'lef•••••42' }])
  })

  it('returns nothing when there are no residual ids', () => {
    expect(residualRows(makeSanitize())).toEqual([])
  })
})
