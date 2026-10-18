import type { Finding, FindingDecision } from '../../core'

/** Decisions keyed by finding id. */
export type DecisionMap = ReadonlyMap<string, FindingDecision>

export function decisionMap(decisions: readonly FindingDecision[]): DecisionMap {
  return new Map(decisions.map((d) => [d.findingId, d] as const))
}

/**
 * Locked findings are mandatory: always removed, checked and not retainable (RETAIN_DENIED_MANDATORY).
 * A finding with no decision counts as locked, so an unexplained finding is never left in the text.
 */
export function isLocked(decision: FindingDecision | undefined): boolean {
  return decision === undefined || decision.mandatory
}

/** The policy would act on the finding, which means anything other than allow. */
export function needsAttention(decision: FindingDecision | undefined): boolean {
  return decision === undefined || decision.action !== 'allow'
}

/** Whether the UI shows the finding as ticked: the user's selection, plus every locked finding. */
export function isChecked(findingId: string, decisions: DecisionMap, selected: ReadonlySet<string>): boolean {
  return selected.has(findingId) || isLocked(decisions.get(findingId))
}

/** Default selection: everything the policy would act on, and every locked finding. */
export function defaultSelection(findings: readonly Finding[], decisions: DecisionMap): Set<string> {
  const ids = findings
    .filter((f) => isLocked(decisions.get(f.findingId)) || needsAttention(decisions.get(f.findingId)))
    .map((f) => f.findingId)
  return new Set(ids)
}

/** Ticks or unticks one finding. A locked finding cannot change, so the same set comes back. */
export function toggleSelection(
  selected: ReadonlySet<string>,
  decisions: DecisionMap,
  findingId: string,
): ReadonlySet<string> {
  if (isLocked(decisions.get(findingId))) return selected
  const next = new Set(selected)
  if (next.has(findingId)) next.delete(findingId)
  else next.add(findingId)
  return next
}

/**
 * Unticked, non-locked findings the policy would act on. These are kept, and their ids are sent to the
 * re-scan as retained. Locked findings are never in this list.
 */
export function retainedIds(
  findings: readonly Finding[],
  decisions: DecisionMap,
  selected: ReadonlySet<string>,
): string[] {
  return findings
    .filter((f) => {
      const decision = decisions.get(f.findingId)
      return !selected.has(f.findingId) && !isLocked(decision) && needsAttention(decision)
    })
    .map((f) => f.findingId)
}

/** Ids to redact, in document order: every ticked finding plus every locked one. */
export function idsToRedact(
  findings: readonly Finding[],
  decisions: DecisionMap,
  selected: ReadonlySet<string>,
): string[] {
  return findings
    .filter((f) => selected.has(f.findingId) || isLocked(decisions.get(f.findingId)))
    .map((f) => f.findingId)
}

/** How many findings the policy would act on. This is the headline count. */
export function countNeedingAttention(findings: readonly Finding[], decisions: DecisionMap): number {
  return findings.filter((f) => needsAttention(decisions.get(f.findingId))).length
}
