import type { Detector, RawFinding } from '../../types'
import { makeFinding, matchAll } from '../util'
import { B64, fake, hasMinEntropy, patternDetector } from './helpers'

const awsAccessKey = patternDetector({
  id: 'secret.aws-access-key',
  category: 'cloud_credential',
  description: 'AWS access key ID (AKIA/ASIA/ABIA/ACCA prefix)',
  examples: {
    positive: ['AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE', 'key: ASIA' + 'IOSFODNN7EXAMPLE here'],
    negative: ['AKIA1234', 'XAKIAIOSFODNN7EXAMPLE', 'AKIAIOSFODNN7EXAMPLEabc'],
  },
  patterns: [
    {
      re: /(?<![A-Za-z0-9])(?:AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}(?![A-Za-z0-9])/g,
      label: 'AWS access key ID',
      placeholder: 'AWS_ACCESS_KEY',
      explanation: 'Matches the format of an AWS access key ID (known provider prefix and length).',
      confidence: 0.95,
      severity: 'critical',
    },
  ],
})

const EMBEDDED_AWS_RE = /(?:AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}/g
const ALNUM = /[A-Za-z0-9]/

/**
 * AWS key IDs glued to other alphanumerics (e.g. two keys concatenated, or "keyAKIA…"). The strict-boundary
 * detector above deliberately skips these; this reports them as UNCERTAIN (0.6) so strict policy reviews them
 * instead of silently allowing a possible key. Found by engine fuzzing.
 */
const awsAccessKeyEmbedded: Detector = {
  id: 'secret.aws-access-key-embedded',
  version: '1.0.0',
  category: 'cloud_credential',
  description: 'AWS access key ID embedded in a longer alphanumeric run (uncertain)',
  examples: {
    positive: ['AKIA' + 'IOSFODNN7EXAMPLE' + 'AKIA' + 'IOSFODNN7EXAMPLE', 'X' + 'AKIA' + 'IOSFODNN7EXAMPLE', 'AKIA' + 'IOSFODNN7EXAMPLEabc'],
    negative: ['AWS_ACCESS_KEY_ID=' + 'AKIA' + 'IOSFODNN7EXAMPLE', 'AKIA1234', 'TAKIA'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(EMBEDDED_AWS_RE, text)) {
      const end = m.index + m[0].length
      const glued = ALNUM.test(text[m.index - 1] ?? '') || ALNUM.test(text[end] ?? '')
      if (!glued) continue // fully bounded: handled by secret.aws-access-key at high confidence
      out.push(
        makeFinding({
          detectorId: 'secret.aws-access-key-embedded',
          detectorVersion: '1.0.0',
          category: 'cloud_credential',
          start: m.index,
          end,
          severity: 'critical',
          confidence: 0.6,
          reasonCode: 'PROVIDER_PREFIX_EMBEDDED',
          label: 'Possible AWS access key ID',
          explanation: 'An AWS access key ID format appears inside a longer alphanumeric run; it may be a key glued to other text.',
          placeholderType: 'AWS_ACCESS_KEY',
          recommendedAction: 'review',
        }),
      )
    }
    return out
  },
}

const awsSecretKey = patternDetector({
  id: 'secret.aws-secret-key',
  category: 'cloud_credential',
  description: '40-character AWS secret access key next to an AWS secret label',
  examples: {
    positive: [
      'aws_secret_access_key = "' + fake(40, 3, B64) + '"',
      'AWS_SECRET_ACCESS_KEY=' + fake(40, 4, B64),
    ],
    negative: ['aws_secret_access_key = "short"', 'secret_access_key: ' + 'A'.repeat(40)],
  },
  patterns: [
    {
      re: /(?<![A-Za-z0-9])(?:aws_?)?secret_?(?:access_?)?key["']?[ \t]{0,3}[:=][ \t]{0,3}["']?([A-Za-z0-9/+=]{40})(?![A-Za-z0-9/+=])/dgi,
      group: 1,
      label: 'AWS secret access key',
      placeholder: 'AWS_SECRET_KEY',
      reasonCode: 'LABEL_CONTEXT',
      explanation: 'A 40-character base64-style value follows an AWS secret key label.',
      confidence: 0.9,
      severity: 'critical',
      accept: hasMinEntropy(3.5),
    },
  ],
})

const gcpApiKey = patternDetector({
  id: 'secret.gcp-api-key',
  category: 'cloud_credential',
  description: 'Google Cloud API key (AIza prefix)',
  examples: {
    positive: ['key=AIza' + fake(35, 5, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-')],
    negative: ['AIzaShort', 'xAIza' + fake(35, 6)],
  },
  patterns: [
    {
      re: /(?<![A-Za-z0-9_-])AIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])/g,
      label: 'Google Cloud API key',
      placeholder: 'GCP_API_KEY',
      explanation: 'Matches the format of a Google API key (AIza prefix, 39 characters).',
      confidence: 0.95,
      severity: 'critical',
    },
  ],
})

const gcpKeyId = patternDetector({
  id: 'secret.gcp-key-id',
  category: 'cloud_credential',
  description: 'private_key_id field of a GCP service-account JSON file',
  examples: {
    positive: ['{"type": "service_account", "private_key_id": "' + fake(40, 7, '0123456789abcdef') + '"}'],
    negative: ['"private_key_id": "abc123"', '"private_key_id": ""'],
  },
  patterns: [
    {
      re: /"private_key_id"\s{0,3}:\s{0,3}"([0-9a-f]{40})"/dg,
      group: 1,
      label: 'GCP service-account key ID',
      placeholder: 'GCP_KEY_ID',
      reasonCode: 'LABEL_CONTEXT',
      explanation: 'A 40-character hex private_key_id appears in service-account JSON.',
      confidence: 0.9,
      severity: 'critical',
    },
  ],
})

const azureStorageKey = patternDetector({
  id: 'secret.azure-storage-key',
  category: 'cloud_credential',
  description: 'Azure storage AccountKey or Service Bus SharedAccessKey in a connection string',
  examples: {
    positive: [
      'DefaultEndpointsProtocol=https;AccountName=demo;AccountKey=' + fake(86, 8, B64) + '==;EndpointSuffix=core.windows.net',
      'Endpoint=sb://demo.servicebus.windows.net/;SharedAccessKeyName=root;SharedAccessKey=' + fake(43, 9, B64) + '=',
    ],
    negative: ['AccountKey=short', 'SharedAccessKey=abc'],
  },
  patterns: [
    {
      re: /AccountKey=([A-Za-z0-9+/]{80,90}={0,2})/dg,
      group: 1,
      label: 'Azure storage account key',
      placeholder: 'AZURE_KEY',
      reasonCode: 'LABEL_CONTEXT',
      explanation: 'A long base64 value follows AccountKey= in a connection string.',
      confidence: 0.95,
      severity: 'critical',
    },
    {
      re: /SharedAccessKey=([A-Za-z0-9+/]{40,90}={0,2})/dg,
      group: 1,
      label: 'Azure shared access key',
      placeholder: 'AZURE_KEY',
      reasonCode: 'LABEL_CONTEXT',
      explanation: 'A long base64 value follows SharedAccessKey= in a connection string.',
      confidence: 0.95,
      severity: 'critical',
    },
  ],
})

const stripeKey = patternDetector({
  id: 'secret.stripe-key',
  category: 'cloud_credential',
  description: 'Stripe secret or restricted API key (live or test)',
  examples: {
    positive: ['STRIPE_KEY=sk_' + 'live_' + fake(24, 10), 'rk_' + 'test_' + fake(24, 11)],
    negative: ['pk_' + 'live_' + fake(24, 12), 'sk_live_short', 'task_live_' + fake(24, 13)],
  },
  patterns: [
    {
      re: /(?<![A-Za-z0-9_])(?:sk|rk)_(live|test)_[A-Za-z0-9]{16,99}(?![A-Za-z0-9])/g,
      label: 'Stripe API key',
      placeholder: 'STRIPE_KEY',
      explanation: 'Matches the format of a Stripe secret/restricted key (sk_/rk_ prefix).',
      confidence: 0.95,
      severity: (m) => (m[1] === 'test' ? 'high' : 'critical'),
    },
  ],
})

export const CLOUD_DETECTORS: Detector[] = [
  awsAccessKey,
  awsAccessKeyEmbedded,
  awsSecretKey,
  gcpApiKey,
  gcpKeyId,
  azureStorageKey,
  stripeKey,
]
