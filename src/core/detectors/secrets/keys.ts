import type { Detector, RawFinding } from '../../types'
import { makeFinding, matchAll } from '../util'
import { DETECTOR_VERSION } from './helpers'

const MAX_KEY_CHARS = 20_000
const MAX_UNTERMINATED_CHARS = 10_000
const MAX_INPUT_CHARS = 100_000
const BASE64_LINE_RE = /^[A-Za-z0-9+/=]*$/
const PEM_HEADER_LINE_RE = /^[A-Za-z-]{2,30}: .{0,200}$/

/** End index of the contiguous base64 block that follows `from` (header lines tolerated first). */
function base64BlockEnd(text: string, from: number): number {
  const limit = Math.min(text.length, from + MAX_INPUT_CHARS)
  let pos = from
  let end = from
  let inBody = false
  while (pos < limit) {
    let eol = text.indexOf('\n', pos)
    if (eol === -1 || eol > limit) eol = limit
    const line = text.slice(pos, eol).replace(/\r$/, '')
    if (line.length > 0) {
      const isBody = BASE64_LINE_RE.test(line)
      if (!isBody && (inBody || !PEM_HEADER_LINE_RE.test(line))) break
      if (isBody) inBody = true
      end = pos + line.length
    }
    pos = eol + 1
  }
  return end
}

const BEGIN_RE = /-----BEGIN [A-Z ]{0,30}PRIVATE KEY(?: BLOCK)?-----/g
const END_RE = /-----END [A-Z ]{0,30}PRIVATE KEY(?: BLOCK)?-----/y

/** Finds the matching END marker within the bounded window, returning its end index or -1. */
function findPemEnd(text: string, from: number): number {
  let idx = text.indexOf('-----END ', from)
  while (idx !== -1 && idx - from <= MAX_KEY_CHARS) {
    END_RE.lastIndex = idx
    const m = END_RE.exec(text)
    if (m) return idx + m[0].length
    idx = text.indexOf('-----END ', idx + 9)
  }
  return -1
}

function keyFinding(id: string, start: number, end: number, complete: boolean, label: string): RawFinding {
  return makeFinding({
    detectorId: id,
    detectorVersion: DETECTOR_VERSION,
    category: 'private_key',
    start,
    end,
    severity: 'critical',
    confidence: complete ? 0.99 : 0.9,
    reasonCode: complete ? 'PEM_BLOCK' : 'PEM_BLOCK_UNTERMINATED',
    label,
    explanation: complete
      ? 'A complete private key block with BEGIN and END markers.'
      : 'A private key BEGIN marker without a matching END marker; the rest of the text is treated as key material.',
    placeholderType: 'PRIVATE_KEY',
  })
}

export const privateKeyDetector: Detector = {
  id: 'secret.private-key',
  version: DETECTOR_VERSION,
  category: 'private_key',
  description: 'PEM-encoded private key blocks (RSA, EC, OpenSSH, PGP, PKCS#8, encrypted)',
  examples: {
    positive: [
      '-----BEGIN RSA PRIVATE KEY-----\nMIIFAKEFAKEFAKE0000\nabcdEFGH1234\n-----END RSA PRIVATE KEY-----',
      'key:\n-----BEGIN PRIVATE KEY-----\nQUJDREVGRw==\n-----END PRIVATE KEY-----\nthanks',
      '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXk=\n',
    ],
    negative: [
      '-----BEGIN PUBLIC KEY-----\nQUJDREVGRw==\n-----END PUBLIC KEY-----',
      '-----BEGIN CERTIFICATE-----\nQUJDREVGRw==\n-----END CERTIFICATE-----',
      'A private key should never be shared.',
    ],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    let from = 0
    for (;;) {
      BEGIN_RE.lastIndex = from
      const m = BEGIN_RE.exec(text)
      if (!m) break
      const bodyStart = m.index + m[0].length
      const end = findPemEnd(text, bodyStart)
      const complete = end !== -1
      const spanEnd = complete
        ? end
        : Math.max(Math.min(text.length, m.index + MAX_UNTERMINATED_CHARS), base64BlockEnd(text, bodyStart))
      out.push(keyFinding('secret.private-key', m.index, spanEnd, complete, 'Private key'))
      from = spanEnd
    }
    return out
  },
}

const PUTTY_RE = /PuTTY-User-Key-File-\d:/g
const PUTTY_MAC_RE = /Private-MAC: ?[0-9a-fA-F]{40,64}/y

export const puttyKeyDetector: Detector = {
  id: 'secret.putty-key',
  version: DETECTOR_VERSION,
  category: 'private_key',
  description: 'PuTTY private key file (.ppk)',
  examples: {
    positive: [
      'PuTTY-User-Key-File-2: ssh-rsa\nEncryption: none\nPrivate-Lines: 1\nQUJDRA==\nPrivate-MAC: ' + 'ab12'.repeat(10),
      'PuTTY-User-Key-File-3: ssh-ed25519\nEncryption: none',
    ],
    negative: ['PuTTY is an SSH client', 'PuTTY-User-Key-File'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    let from = 0
    for (const m of matchAll(PUTTY_RE, text)) {
      if (m.index < from) continue
      const macAt = text.indexOf('Private-MAC:', m.index)
      let end = -1
      if (macAt !== -1 && macAt - m.index <= MAX_KEY_CHARS) {
        PUTTY_MAC_RE.lastIndex = macAt
        const mac = PUTTY_MAC_RE.exec(text)
        if (mac) end = macAt + mac[0].length
      }
      const complete = end !== -1
      const spanEnd = complete ? end : Math.min(text.length, m.index + MAX_UNTERMINATED_CHARS)
      out.push(keyFinding('secret.putty-key', m.index, spanEnd, complete, 'PuTTY private key'))
      from = spanEnd
    }
    return out
  },
}

export const KEY_DETECTORS: Detector[] = [privateKeyDetector, puttyKeyDetector]
