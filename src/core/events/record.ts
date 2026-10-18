/**
 * Privacy-safe event record (PRD FR-026/FR-028). Counts and enums only: no text, offsets, values,
 * ids, durations or content hashes. The day is a UTC bucket, never a precise time.
 */
import { z } from 'zod'
import { ACTIONS, CATEGORIES, type Category, type SanitizeResult, type ScanResult } from '../types'

const RISK_BANDS = ['none', 'low', 'medium', 'high', 'critical'] as const

export const EventRecordSchema = z.strictObject({
  schemaVersion: z.literal(1),
  kind: z.enum(['simulation', 'submission']),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  policyId: z.string().max(40),
  policyVersion: z.string().max(20),
  coreVersion: z.string().max(20),
  status: z.enum(['completed', 'partial', 'failed']),
  decision: z.enum(ACTIONS),
  riskBand: z.enum(RISK_BANDS).nullable(),
  categoryCounts: z.partialRecord(z.enum(CATEGORIES), z.number().int().min(0).max(100_000)),
  findingCount: z.number().int().min(0).max(100_000),
  validationPassed: z.boolean().nullable(),
})
export type EventRecord = z.infer<typeof EventRecordSchema>
export type EventKind = EventRecord['kind']

export interface ToEventOptions {
  sanitize?: SanitizeResult
  now?: () => Date
}

export function toEventRecord(scan: ScanResult, kind: EventKind, opts: ToEventOptions = {}): EventRecord {
  const counts: Partial<Record<Category, number>> = {}
  for (const f of scan.findings) counts[f.category] = (counts[f.category] ?? 0) + 1
  const now = opts.now ?? (() => new Date())
  return {
    schemaVersion: 1,
    kind,
    day: now().toISOString().slice(0, 10),
    policyId: scan.policyId,
    policyVersion: scan.policyVersion,
    coreVersion: scan.coreVersion,
    status: scan.status,
    decision: scan.policyDecision,
    riskBand: scan.riskBand,
    categoryCounts: counts,
    findingCount: scan.findings.length,
    validationPassed: opts.sanitize ? opts.sanitize.validationPassed : null,
  }
}
