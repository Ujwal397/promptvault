import type { Detector, RawFinding } from '../../types'
import { makeFinding, matchAll } from '../util'
import { b64url, DETECTOR_VERSION, fake, B64URL, pickValue } from './helpers'

const JWT_RE = /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{8,2000}\.[A-Za-z0-9_-]{8,4000}\.[A-Za-z0-9_-]{0,1000}(?![A-Za-z0-9_-])/g

function decodeBase64Url(s: string): string | null {
  try {
    const b = s.replace(/-/g, '+').replace(/_/g, '/')
    return atob(b + '='.repeat((4 - (b.length % 4)) % 4))
  } catch {
    return null
  }
}

/** True when the first JWT segment decodes to a JSON object with an "alg" key. */
function hasJwtHeader(token: string): boolean {
  const header = decodeBase64Url(token.slice(0, token.indexOf('.')))
  if (header === null) return false
  try {
    const parsed: unknown = JSON.parse(header)
    return typeof parsed === 'object' && parsed !== null && 'alg' in parsed
  } catch {
    return false
  }
}

const JWT_HEADER = b64url('{"alg":"HS256","typ":"JWT"}')
const JWT_PAYLOAD = b64url('{"sub":"1234567890","name":"Test User"}')

export const jwtDetector: Detector = {
  id: 'secret.jwt',
  version: DETECTOR_VERSION,
  category: 'credential',
  description: 'JSON Web Token (three base64url segments, header decoded and checked for "alg")',
  examples: {
    positive: [
      `token: ${JWT_HEADER}.${JWT_PAYLOAD}.${fake(43, 60, B64URL)}`,
      `eyJhbGciOiJub25lIn0.${JWT_PAYLOAD}.`,
    ],
    negative: ['eyJhbGciOi', 'eyJ.abc.def', 'see eyJshort.eyJshort'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(JWT_RE, text)) {
      const valid = hasJwtHeader(m[0])
      out.push(
        makeFinding({
          detectorId: 'secret.jwt',
          detectorVersion: DETECTOR_VERSION,
          category: 'credential',
          start: m.index,
          end: m.index + m[0].length,
          severity: 'high',
          confidence: valid ? 0.9 : 0.5,
          reasonCode: valid ? 'JWT_STRUCTURE_VALID' : 'JWT_SHAPE_ONLY',
          label: 'JSON Web Token',
          explanation: valid
            ? 'Three base64url segments whose header decodes to JSON with an "alg" field.'
            : 'Three base64url segments starting with eyJ, but the header did not decode as expected.',
          placeholderType: 'JWT',
        }),
      )
    }
    return out
  },
}

const HEADER_RE =
  /(?:authorization|proxy-authorization)["']?[ \t]{0,3}[:=][ \t]{0,3}["']?[ \t]{0,2}(bearer|basic|token)[ \t]{1,3}([A-Za-z0-9._~+/=-]{8,2048})/dgi
const STANDALONE_BEARER_RE = /(?<![A-Za-z0-9])bearer[ \t]{1,3}([A-Za-z0-9._~+/=-]{20,2048})/dgi

export const authHeaderDetector: Detector = {
  id: 'secret.auth-header',
  version: DETECTOR_VERSION,
  category: 'credential',
  description: 'Authorization header credentials (Bearer / Basic tokens)',
  examples: {
    positive: [
      'Authorization: Bearer ' + fake(40, 61),
      'headers = {"Authorization": "Basic dXNlcjpodW50ZXIy"}',
      "curl -H 'authorization: bearer " + fake(30, 62) + "' https://api.example.com",
      'const h = `Bearer ' + fake(32, 63) + '`',
    ],
    negative: [
      'Authorization: Bearer ${TOKEN}',
      'Authorization: Bearer <token>',
      'Authorization: Bearer [BEARER_TOKEN_1]',
      'the bearer of this letter',
      'Authorization: Basic',
    ],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    const seen = new Set<number>()
    const emit = (start: number, end: number, basic: boolean) => {
      if (seen.has(start)) return
      seen.add(start)
      out.push(
        makeFinding({
          detectorId: 'secret.auth-header',
          detectorVersion: DETECTOR_VERSION,
          category: 'credential',
          start,
          end,
          severity: 'critical',
          confidence: 0.9,
          reasonCode: 'AUTH_HEADER',
          label: basic ? 'Basic auth credentials' : 'Bearer token',
          explanation: basic
            ? 'Value of an Authorization: Basic header (base64 of user:password).'
            : 'Token following the Bearer scheme in an authorization header.',
          placeholderType: basic ? 'BASIC_AUTH' : 'BEARER_TOKEN',
        }),
      )
    }
    for (const m of matchAll(HEADER_RE, text)) {
      const v = pickValue(m, 2)
      if (v) emit(v.start, v.end, m[1].toLowerCase() === 'basic')
    }
    for (const m of matchAll(STANDALONE_BEARER_RE, text)) {
      const v = pickValue(m, 1)
      if (v && /[0-9]/.test(v.value)) emit(v.start, v.end, false)
    }
    return out
  },
}

export const BEARER_DETECTORS: Detector[] = [jwtDetector, authHeaderDetector]
