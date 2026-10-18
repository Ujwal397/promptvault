import type { Policy } from '../../core'

/** Long enough for the browser to start the download before the object URL goes away. */
const REVOKE_DELAY_MS = 1000

/** The policy as JSON text. It holds rules and settings only, never prompt text. */
export function policyJson(policy: Policy): string {
  return `${JSON.stringify(policy, null, 2)}\n`
}

/** A file name built from the policy id, with anything outside a-z, 0-9 and dashes replaced. */
export function exportFileName(policy: Policy): string {
  const slug = policy.policyId.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || 'policy'
  return `promptvault-policy-${slug}.json`
}

/** Downloads the policy through a Blob and an object URL. The URL is revoked once the download has started. */
export function downloadPolicyJson(policy: Policy): void {
  const url = URL.createObjectURL(new Blob([policyJson(policy)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = exportFileName(policy)
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}
