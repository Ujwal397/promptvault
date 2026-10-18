import type { Detector, RawFinding } from '../../types'
import { makeFinding, matchAll } from '../util'

const MRN_RE =
  /(?<![A-Za-z])(?:MRN|medical[ \t]+record[ \t]+(?:number|no\.?|#)|patient[ \t]+ID|health[ \t]+insurance[ \t]+(?:number|no\.?|ID|#)|(?:insurance[ \t]+)?policy[ \t]+(?:number|no\.?|#))[ \t]{0,3}(?:is[ \t]+)?[:#=]?[ \t]{0,3}([A-Za-z0-9][A-Za-z0-9-]{3,19})(?![A-Za-z0-9])/gi

export const mrnDetector: Detector = {
  id: 'health.mrn',
  version: '1.0.0',
  category: 'health',
  description: 'Medical record / patient / insurance identifiers (label required)',
  examples: {
    positive: ['MRN: 00123456', 'Medical record number 4455667', 'patient ID: P-778899', 'health insurance number: HX12345678'],
    negative: ['MRN: pending', 'the patient was seen', 'policy number is on file', 'record 12345678'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(MRN_RE, text)) {
      const value = m[1]
      if (!/\d/.test(value)) continue
      const start = m.index + m[0].length - value.length
      out.push(
        makeFinding({
          detectorId: 'health.mrn',
          detectorVersion: '1.0.0',
          category: 'health',
          start,
          end: start + value.length,
          severity: 'high',
          confidence: 0.7,
          reasonCode: 'LABEL_CONTEXT',
          label: 'Medical identifier',
          explanation: 'An identifier follows a medical record, patient ID or insurance number label.',
          placeholderType: 'MEDICAL_ID',
        }),
      )
    }
    return out
  },
}
