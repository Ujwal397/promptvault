import { describe, expect, it } from 'vitest'
import { STRICT_POLICY, sanitize, scan, type PlaceholderMode } from '../../core'
import { previewPlaceholder } from './placeholderPreview'

// Synthetic sample; example.com is a reserved domain.
const SAMPLE = 'Please reply to jane.doe@example.com before Friday.'

/** Runs the real engine on the sample and returns the placeholder it wrote for the email. */
function realPlaceholder(mode: PlaceholderMode): { type: string; placeholder: string } {
  const policy = STRICT_POLICY
  const found = scan({ requestId: 'preview-check', text: SAMPLE, policy })
  const email = found.findings.find((f) => f.category === 'email')
  if (!email) throw new Error('The synthetic sample should contain an email finding')
  const result = sanitize({
    requestId: 'preview-check',
    sourceText: SAMPLE,
    findings: found.findings,
    findingIds: [email.findingId],
    placeholderMode: mode,
    policy,
  })
  const replacement = result.replacements[0]
  if (!replacement) throw new Error('The email finding should be redacted')
  return { type: email.placeholderType, placeholder: replacement.placeholder }
}

describe('previewPlaceholder', () => {
  it('labelled mode shows TYPE_N, copied in brackets', () => {
    expect(previewPlaceholder('typed', 'EMAIL')).toEqual({ bar: 'EMAIL_1', copied: '[EMAIL_1]' })
  })

  it('mask mode shows REDACTED_TYPE, copied in brackets', () => {
    expect(previewPlaceholder('mask', 'EMAIL')).toEqual({ bar: 'REDACTED_EMAIL', copied: '[REDACTED_EMAIL]' })
  })

  it.each<PlaceholderMode>(['typed', 'mask'])('%s matches what the real engine writes', (mode) => {
    const real = realPlaceholder(mode)
    expect(real.type).toBe('EMAIL')
    expect(previewPlaceholder(mode, real.type).copied).toBe(real.placeholder)
  })
})
