import type { Detector, RawFinding } from '../../types'
import { hasLabelBefore, makeFinding, matchAll } from '../util'

// Candidate run of hex digits and colons; structure is validated in code to keep the regex linear.
const CANDIDATE_RE = /(?<![0-9A-Fa-f:])[0-9A-Fa-f:]{2,39}(?![0-9A-Fa-f:])/g

/** Validates full or "::"-compressed IPv6 (no embedded IPv4, no zone id). */
export function isIpv6(s: string): boolean {
  const halves = s.split('::')
  if (halves.length > 2) return false
  const groups = (h: string) => (h === '' ? [] : h.split(':'))
  const head = groups(halves[0])
  const tail = halves.length === 2 ? groups(halves[1]) : []
  const all = [...head, ...tail]
  if (!all.every((g) => /^[0-9A-Fa-f]{1,4}$/.test(g))) return false
  return halves.length === 2 ? all.length <= 7 : all.length === 8
}

export const ipv6Detector: Detector = {
  id: 'pii.ipv6',
  version: '1.0.0',
  category: 'ip_address',
  description: 'IPv6 addresses (full or compressed, structure-validated)',
  examples: {
    positive: ['server at 2001:db8:85a3::8a2e:370:7334 is down', 'ip 2001:0db8:0000:0000:0000:ff00:0042:8329'],
    negative: ['time 12:30:45', 'ratio a:b', 'c++ std::vector', 'mac aa:bb:cc:dd:ee:ff', 'just ::'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(CANDIDATE_RE, text)) {
      const value = m[0]
      // Require at least two hex groups so "::" and short tokens like "a::b" in code do not fire without a label.
      const hexGroups = value.split(':').filter((g) => g !== '').length
      if (!isIpv6(value) || hexGroups < 2) continue
      const labeled = hasLabelBefore(text, m.index, ['ip', 'ipv6', 'address', 'host', 'server'], 16)
      if (hexGroups < 4 && !labeled) continue
      const loopbackOrDoc = /^(::1|fe80:|2001:db8:)/i.test(value)
      out.push(
        makeFinding({
          detectorId: 'pii.ipv6',
          detectorVersion: '1.0.0',
          category: 'ip_address',
          start: m.index,
          end: m.index + value.length,
          severity: 'low',
          confidence: labeled ? 0.85 : loopbackOrDoc ? 0.6 : 0.7,
          reasonCode: 'IPV6_FORMAT',
          label: 'IPv6 address',
          explanation: 'Structurally valid IPv6 address (hex groups with optional :: compression).',
          placeholderType: 'IP',
        }),
      )
    }
    return out
  },
}
