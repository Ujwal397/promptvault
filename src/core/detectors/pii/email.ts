import type { Detector } from '../../types'
import { makeFinding, matchAll } from '../util'

const EMAIL_RE = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,7}\.[A-Za-z]{2,24}/g

export const emailDetector: Detector = {
  id: 'pii.email',
  version: '1.0.0',
  category: 'email',
  description: 'Email addresses',
  examples: {
    positive: ['contact user@example.com today', 'first.last+tag@sub.example.co.uk'],
    negative: ['no at sign here', 'user@localhost', '@handle and a@b'],
  },
  detect({ text }) {
    const out = []
    for (const m of matchAll(EMAIL_RE, text)) {
      out.push(
        makeFinding({
          detectorId: 'pii.email',
          detectorVersion: '1.0.0',
          category: 'email',
          start: m.index,
          end: m.index + m[0].length,
          severity: 'medium',
          confidence: 0.95,
          reasonCode: 'EMAIL_FORMAT',
          label: 'Email address',
          explanation: 'Text matches the structure of an email address.',
          placeholderType: 'EMAIL',
        }),
      )
    }
    return out
  },
}
