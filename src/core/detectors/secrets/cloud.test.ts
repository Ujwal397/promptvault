import { describe, expect, it } from 'vitest'
import { CLOUD_DETECTORS } from './cloud'
import { byId, describeExamples } from './testing'
import { B64, fake } from './helpers'

describeExamples(CLOUD_DETECTORS)

describe('cloud span exactness', () => {
  it('AWS access key span is the key only', () => {
    const text = 'id=AKIAIOSFODNN7EXAMPLE;'
    const [f] = byId(CLOUD_DETECTORS, 'secret.aws-access-key').detect({ text })
    expect(text.slice(f.startOffset, f.endOffset)).toBe('AKIAIOSFODNN7EXAMPLE')
    expect(f.confidence).toBe(0.95)
    expect(f.placeholderType).toBe('AWS_ACCESS_KEY')
  })

  it('AWS secret span excludes label and quotes', () => {
    const secret = fake(40, 3, B64)
    const text = `aws_secret_access_key = "${secret}"`
    const [f] = byId(CLOUD_DETECTORS, 'secret.aws-secret-key').detect({ text })
    expect(text.slice(f.startOffset, f.endOffset)).toBe(secret)
  })

  it('Stripe test keys are high severity, live keys critical', () => {
    const d = byId(CLOUD_DETECTORS, 'secret.stripe-key')
    const test = 'sk_' + 'test_' + fake(24, 1)
    const live = 'sk_' + 'live_' + fake(24, 2)
    expect(d.detect({ text: test })[0].severity).toBe('high')
    expect(d.detect({ text: live })[0].severity).toBe('critical')
  })

  it('GCP key id span is the hex value only', () => {
    const id = fake(40, 7, '0123456789abcdef')
    const text = `{"private_key_id": "${id}"}`
    const [f] = byId(CLOUD_DETECTORS, 'secret.gcp-key-id').detect({ text })
    expect(text.slice(f.startOffset, f.endOffset)).toBe(id)
  })

  it('Azure key span is the base64 value', () => {
    const key = fake(86, 8, B64) + '=='
    const text = `AccountName=x;AccountKey=${key};Suffix=y`
    const [f] = byId(CLOUD_DETECTORS, 'secret.azure-storage-key').detect({ text })
    expect(text.slice(f.startOffset, f.endOffset)).toBe(key)
  })

  it('never says valid or live and never leaks the value', () => {
    for (const d of CLOUD_DETECTORS) {
      for (const text of d.examples.positive) {
        for (const f of d.detect({ text })) {
          expect(f.explanation).not.toMatch(/\b(valid|live|confirmed)\b/i)
          expect(f.explanation).not.toContain(text.slice(f.startOffset, f.endOffset))
        }
      }
    }
  })
})
