import type { Detector, RawFinding } from '../../types'
import { makeFinding, matchAll, shannonEntropy } from '../util'
import { charClassCount, DETECTOR_VERSION, fake } from './helpers'

// "=" is allowed only as trailing base64 padding, so "KEY=value" and "a=b+c" assignments are not one token.
const CANDIDATE_RE = /(?<![A-Za-z0-9+/_-])[A-Za-z0-9+/_-]{24,1024}={0,2}(?![A-Za-z0-9+/=_-])/g
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HEX_RE = /^[0-9a-f]+$/i
const DATA_URI_BEFORE_RE = /data:[\w/+.-]{1,60};base64,$/i
const MIN_ENTROPY = 4.0

function isPathOrUrlLike(text: string, start: number, token: string): boolean {
  if (token.startsWith('/') || token.startsWith('./') || token.startsWith('../')) return true
  const slashes = token.split('/').length - 1
  if (slashes >= 3 && token.length / (slashes + 1) < 12) return true
  const before = text.slice(Math.max(0, start - 300), start)
  const wordStart = Math.max(before.lastIndexOf(' '), before.lastIndexOf('\n'), before.lastIndexOf('\t'))
  return before.slice(wordStart + 1).includes('://')
}

function isCandidate(text: string, start: number, token: string): boolean {
  if (UUID_RE.test(token) || HEX_RE.test(token)) return false
  if (charClassCount(token.replace(/[+/=_-]/g, '#')) < 3) return false
  if (DATA_URI_BEFORE_RE.test(text.slice(Math.max(0, start - 100), start))) return false
  if (isPathOrUrlLike(text, start, token)) return false
  return shannonEntropy(token) >= MIN_ENTROPY
}

function overlaps(start: number, end: number, others: RawFinding[]): boolean {
  return others.some((o) => start < o.endOffset && o.startOffset < end)
}

/**
 * Supporting evidence only. `others` are the more specific detectors whose hits take priority:
 * tokens they already cover are not re-reported here.
 */
export function createEntropyDetector(others: Detector[]): Detector {
  return {
    id: 'secret.high-entropy',
    version: DETECTOR_VERSION,
    category: 'credential',
    description: 'Unlabeled high-entropy token (supporting evidence, low confidence)',
    examples: {
      positive: ['value is ' + fake(40, 90), 'x = "' + fake(32, 91, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/') + '"'],
      negative: [
        '123e4567-e89b-12d3-a456-426614174000',
        '9fceb02d0ae598e95dc970b74767f19372d61af8',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        '#ff00aa and #1a2b3c',
        'data:image/png;base64,' + fake(60, 92, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'),
        'https://example.com/a/b/c/some-long-path-segment-here/index.html',
        'src/components/ui/Button/index.tsx and more/path/like/this/one',
        'getUserAccountInformationFromDatabase',
      ],
    },
    detect({ text }) {
      const known = others.flatMap((d) => d.detect({ text }))
      const out: RawFinding[] = []
      for (const m of matchAll(CANDIDATE_RE, text)) {
        const end = m.index + m[0].length
        if (!isCandidate(text, m.index, m[0]) || overlaps(m.index, end, known)) continue
        const entropy = shannonEntropy(m[0])
        out.push(
          makeFinding({
            detectorId: 'secret.high-entropy',
            detectorVersion: DETECTOR_VERSION,
            category: 'credential',
            start: m.index,
            end,
            severity: 'medium',
            confidence: Math.min(0.45, 0.3 + (entropy - MIN_ENTROPY) * 0.1),
            reasonCode: 'HIGH_ENTROPY_UNLABELED',
            recommendedAction: 'review',
            label: 'High-entropy string',
            explanation: 'A long random-looking string with mixed character classes; no label or provider format confirms it is a credential.',
            placeholderType: 'TOKEN',
          }),
        )
      }
      return out
    },
  }
}
