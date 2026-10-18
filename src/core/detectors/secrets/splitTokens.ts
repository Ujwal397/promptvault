import type { Detector, RawFinding } from '../../types'
import { makeFinding } from '../util'
import { CLOUD_DETECTORS } from './cloud'

// 1.0.1: excludes the uncertain embedded-AWS detector from rejoined-token checks.
const SPLIT_VERSION = '1.0.1'
import { PREFIX_PROVIDER_DETECTORS } from './providers'
import { TOKEN_DETECTORS } from './tokens'
import { jwtDetector } from './bearer'

const MAX_TOKEN = 256
const MAX_INDENT = 8
const MIN_LEFT = 4

/** High-confidence, prefix-based detectors only (no entropy, password, assignment or PEM detectors). */
// The uncertain embedded-AWS detector is excluded: split-token targets only well-bounded provider formats.
const UNDERLYING: Detector[] = [...CLOUD_DETECTORS.filter((d) => d.id !== 'secret.aws-access-key-embedded'), ...TOKEN_DETECTORS, ...PREFIX_PROVIDER_DETECTORS, jwtDetector]

function isTokenChar(code: number): boolean {
  return (
    (code >= 48 && code <= 57) || // 0-9
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122) || // a-z
    code === 95 || // _
    code === 45 || // -
    code === 43 || // +
    code === 47 || // /
    code === 61 || // =
    code === 46 // .
  )
}

interface Join {
  leftStart: number
  rightStart: number
  rightEnd: number
  joinAt: number
  joined: string
}

function buildJoin(text: string, nl: number): Join | null {
  const leftEnd = nl > 0 && text.charCodeAt(nl - 1) === 13 ? nl - 1 : nl
  let leftStart = leftEnd
  while (leftStart > 0 && leftEnd - leftStart < MAX_TOKEN && isTokenChar(text.charCodeAt(leftStart - 1))) leftStart--
  if (leftEnd - leftStart < MIN_LEFT) return null

  let p = nl + 1
  const indentLimit = p + MAX_INDENT
  while (p < text.length && p < indentLimit && (text[p] === ' ' || text[p] === '\t')) p++
  let rightEnd = p
  while (rightEnd < text.length && rightEnd - p < MAX_TOKEN && isTokenChar(text.charCodeAt(rightEnd))) rightEnd++
  if (rightEnd === p) return null

  const left = text.slice(leftStart, leftEnd)
  return { leftStart, rightStart: p, rightEnd, joinAt: left.length, joined: left + text.slice(p, rightEnd) }
}

function toSplit(f: RawFinding, underlyingId: string, join: Join): RawFinding {
  return {
    ...makeFinding({
      detectorId: 'secret.split-token',
      detectorVersion: SPLIT_VERSION,
      category: f.category,
      start: join.leftStart + f.startOffset,
      end: join.rightStart + (f.endOffset - join.joinAt),
      severity: f.severity,
      confidence: f.confidence * 0.9,
      reasonCode: 'SPLIT_ACROSS_LINES',
      label: f.label,
      explanation: `${f.label} format split across a line break`,
      placeholderType: f.placeholderType,
    }),
    mergedDetectorIds: [underlyingId],
  }
}

function crossing(join: Join): RawFinding[] {
  const out: RawFinding[] = []
  for (const d of UNDERLYING) {
    for (const f of d.detect({ text: join.joined })) {
      if (f.startOffset < join.joinAt && f.endOffset > join.joinAt) out.push(toSplit(f, d.id, join))
    }
  }
  return out
}

export const splitTokenDetector: Detector = {
  id: 'secret.split-token',
  version: SPLIT_VERSION,
  category: 'cloud_credential',
  description: 'Provider-prefixed token broken across a line break (optionally with indentation)',
  examples: {
    positive: ['key: AKIAIOSFODNN7\nEXAMPLE', 'AKIAIOSFODNN7\r\n    EXAMPLE'],
    negative: ['AKIAIOSFODNN7EXAMPLE', 'const userName = 1\nfooBarBaz()', 'import a from "b"\nimport c from "d"'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) {
      const join = buildJoin(text, i)
      if (join) out.push(...crossing(join))
    }
    return out
  },
}

export const SPLIT_TOKEN_DETECTORS: Detector[] = [splitTokenDetector]
