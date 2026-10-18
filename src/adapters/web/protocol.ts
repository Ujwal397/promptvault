/** Worker message protocol. Every message is validated on both sides; messages are untrusted. */
import { z } from 'zod'
import { ACTIONS, PolicySchema } from '../../core'

const ScanOptionsSchema = z
  .object({
    timeoutMs: z.number().optional(),
    maxFindings: z.number().optional(),
    faultInjection: z.object({ failDetectorId: z.string() }).optional(),
    retainedFindingIds: z.array(z.string()).optional(),
  })
  .optional()

const ScanPayloadSchema = z.object({
  requestId: z.string(),
  text: z.string(),
  policy: PolicySchema,
  options: ScanOptionsSchema,
})

const SanitizePayloadSchema = z.object({
  requestId: z.string(),
  sourceText: z.string(),
  findings: z.array(z.looseObject({ findingId: z.string(), startOffset: z.number(), endOffset: z.number() })),
  findingIds: z.array(z.string()),
  placeholderMode: z.enum(['typed', 'mask']),
  policy: PolicySchema,
  structured: z.boolean().optional(),
  includeMapping: z.boolean().optional(),
  options: ScanOptionsSchema,
})

export const EVAL_CORPORA = ['regression', 'blind'] as const
export type EvalCorpus = (typeof EVAL_CORPORA)[number]

/** Attack suite: runs a built-in synthetic corpus inside the worker. No user text is involved. */
const EvaluatePayloadSchema = z.object({
  policy: PolicySchema,
  corpus: z.enum(EVAL_CORPORA),
})

const IdSchema = z.string().min(1).max(100)

export const WorkerRequestSchema = z.discriminatedUnion('type', [
  z.object({ id: IdSchema, type: z.literal('scan'), payload: ScanPayloadSchema }),
  z.object({ id: IdSchema, type: z.literal('sanitize'), payload: SanitizePayloadSchema }),
  z.object({ id: IdSchema, type: z.literal('evaluate'), payload: EvaluatePayloadSchema }),
  z.object({ id: IdSchema, type: z.literal('ping'), payload: z.unknown() }),
])
export type WorkerRequest = z.infer<typeof WorkerRequestSchema>

const ErrorSchema = z.object({ code: z.string().max(60), message: z.string().max(500) })

export const WorkerResponseSchema = z.union([
  z.object({ id: IdSchema, ok: z.literal(true), result: z.unknown() }),
  z.object({ id: IdSchema, ok: z.literal(false), error: ErrorSchema }),
])
export type WorkerResponse = z.infer<typeof WorkerResponseSchema>

export const ScanResultShape = z.looseObject({
  requestId: z.string(),
  status: z.enum(['completed', 'partial', 'failed']),
  findings: z.array(z.looseObject({ findingId: z.string() })),
  policyDecision: z.enum(ACTIONS),
  errors: z.array(z.looseObject({ code: z.string() })),
})

export const SanitizeResultShape = z.looseObject({
  status: z.enum(['completed', 'rejected', 'failed']),
  validationPassed: z.boolean(),
  errors: z.array(z.looseObject({ code: z.string() })),
})

const NullableRatio = z.number().min(0).max(1).nullable()

export const EvalReportShape = z.looseObject({
  corpusVersion: z.string(),
  totals: z.looseObject({ cases: z.number().int().min(0), precision: NullableRatio, recall: NullableRatio }),
  perCategory: z.record(z.string(), z.looseObject({ precision: NullableRatio, recall: NullableRatio })),
  falseBlockRate: NullableRatio,
  latency: z.looseObject({ p50: z.number().nullable(), p95: z.number().nullable(), max: z.number().nullable() }),
  cases: z.array(z.looseObject({ id: z.string(), decisionCorrect: z.boolean() })),
})

export function parseRequest(data: unknown): WorkerRequest | null {
  const r = WorkerRequestSchema.safeParse(data)
  return r.success ? r.data : null
}

export function parseResponse(data: unknown): WorkerResponse | null {
  const r = WorkerResponseSchema.safeParse(data)
  return r.success ? r.data : null
}

/** Best-effort id extraction from a malformed message, so the caller can be failed closed. */
export function extractId(data: unknown): string | null {
  if (typeof data === 'object' && data !== null && 'id' in data) {
    const id = (data as { id: unknown }).id
    if (typeof id === 'string') return id
  }
  return null
}
