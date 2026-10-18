import type { ScanClient } from '../../adapters/web/scanClient'
import type { PlaceholderMode } from '../../core'
import type { SanitizedOutput, ScanSnapshot } from './scanFlowState'
import { decisionMap, idsToRedact, retainedIds } from './selection'

export interface RedactionInput {
  snapshot: ScanSnapshot
  /** The finding ids the user has ticked. Locked findings are added regardless. */
  selected: ReadonlySet<string>
  placeholderMode: PlaceholderMode
  newRequestId: () => string
}

export type RedactionOutcome = { ok: true; output: SanitizedOutput } | { ok: false; message: string }

export const RESCAN_FAILED = 'The re-scan did not finish, so nothing was redacted. Try again.'
export const SELECTION_STALE = 'The findings changed since the scan, so nothing was redacted. Scan again.'
export const REDACTION_FAILED = 'Redaction did not finish, so nothing was copied. Try again.'
const UNEXPECTED = 'Redaction could not run, so nothing was redacted.'

type Client = Pick<ScanClient, 'scan' | 'sanitize'>

/**
 * Redacts the ticked findings. Any finding the user unticked (and the policy would act on) is retained:
 * the text is re-scanned with those ids, and the re-scan's findings and decisions drive the redaction.
 * Locked (mandatory) findings are always redacted, and never retained. Nothing here throws: any failure
 * is returned as a message, so the caller stays on Review and nothing is treated as clean.
 */
export async function runRedaction(client: Client, input: RedactionInput): Promise<RedactionOutcome> {
  try {
    return await redact(client, input)
  } catch {
    return { ok: false, message: UNEXPECTED }
  }
}

async function redact(client: Client, input: RedactionInput): Promise<RedactionOutcome> {
  const { text, policy, result } = input.snapshot
  const kept = retainedIds(result.findings, decisionMap(result.findingDecisions), input.selected)

  // Finding ids are stable for the same text and policy (f-<n> by position), so the re-scan only changes decisions.
  let scan = result
  if (kept.length > 0) {
    const rescan = await client.scan({
      requestId: input.newRequestId(),
      text,
      policy,
      options: { retainedFindingIds: kept },
    })
    if (rescan.status !== 'completed') return { ok: false, message: RESCAN_FAILED }
    scan = rescan
  }

  const known = new Set(scan.findings.map((f) => f.findingId))
  if ([...input.selected].some((id) => !known.has(id))) return { ok: false, message: SELECTION_STALE }

  const sanitized = await client.sanitize({
    requestId: input.newRequestId(),
    sourceText: text,
    findings: scan.findings,
    findingIds: idsToRedact(scan.findings, decisionMap(scan.findingDecisions), input.selected),
    placeholderMode: input.placeholderMode,
    policy,
    structured: true,
    includeMapping: true,
    options: kept.length > 0 ? { retainedFindingIds: kept } : undefined,
  })
  if (sanitized.status !== 'completed' || sanitized.sanitizedText === null) {
    return { ok: false, message: REDACTION_FAILED }
  }
  return { ok: true, output: { source: text, scan, result: sanitized, kept: kept.length } }
}
