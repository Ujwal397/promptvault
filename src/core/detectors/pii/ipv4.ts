import type { Detector, RawFinding } from '../../types'
import { hasLabelBefore, makeFinding, matchAll } from '../util'

const IPV4_RE = /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?!\d|\.\d)/g

function parseOctets(s: string): number[] | null {
  const parts = s.split('.')
  if (parts.length !== 4) return null
  const out: number[] = []
  for (const p of parts) {
    if (p.length > 1 && p.startsWith('0')) return null
    const n = Number(p)
    if (!Number.isInteger(n) || n > 255) return null
    out.push(n)
  }
  return out
}

function isNonPublic(o: number[]): boolean {
  const [a, b] = o
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  )
}

export const ipv4Detector: Detector = {
  id: 'pii.ipv4',
  version: '1.0.0',
  category: 'ip_address',
  description: 'IPv4 addresses (octet-validated)',
  examples: {
    positive: ['server at 203.0.113.45 is down', 'connect to 192.168.1.10'],
    negative: ['version 1.2.3.4 released', 'v10.2.3.4', 'bad 999.1.1.1', 'octet 01.2.3.4'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(IPV4_RE, text)) {
      const octets = parseOctets(m[0])
      if (!octets) continue
      const before = text.slice(Math.max(0, m.index - 12), m.index)
      if (/[vV]$/.test(before) || /version[\s:=]*$/i.test(before)) continue
      let confidence = isNonPublic(octets) ? 0.4 : 0.7
      if (hasLabelBefore(text, m.index, ['ip', 'address', 'host', 'server'], 16)) {
        confidence = Math.min(0.9, confidence + 0.15)
      }
      out.push(
        makeFinding({
          detectorId: 'pii.ipv4',
          detectorVersion: '1.0.0',
          category: 'ip_address',
          start: m.index,
          end: m.index + m[0].length,
          severity: 'low',
          confidence,
          reasonCode: isNonPublic(octets) ? 'IPV4_NON_PUBLIC' : 'IPV4_FORMAT',
          label: 'IPv4 address',
          explanation: isNonPublic(octets)
            ? 'Valid IPv4 address in a private, loopback or reserved range.'
            : 'Valid IPv4 address with all octets in range.',
          placeholderType: 'IP',
        }),
      )
    }
    return out
  },
}
