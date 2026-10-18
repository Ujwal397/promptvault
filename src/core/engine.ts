/**
 * Engine facade: input validation → detection → contextual analysis → reconciliation →
 * risk scoring → policy evaluation; and sanitize → post-redaction validation.
 * Fails closed: every failure path yields an explicit status and never a clean "allow".
 */
import { z } from 'zod'
import {
  CATEGORIES,
  CORE_VERSION,
  MAX_INPUT_CHARS,
  SEVERITIES,
  type EngineError,
  type Finding,
  type Policy,
  type PolicyAction,
  type RawFinding,
  type SanitizeRequest,
  type SanitizeResult,
  type Span,
  type ScanOptions,
  type ScanRequest,
  type ScanResult,
} from './types'
import { BUILTIN_DETECTORS, buildCustomDetectors, runDetectors } from './detectors'
import { compromiseAnalyzer } from './context'
import { reconcile } from './reconcile'
import { computeRisk } from './policy/scoring'
import { evaluatePolicy } from './policy/evaluate'
import { parsePolicy } from './policy/parse'
import { applyRedactions } from './redaction/redact'

const DEFAULT_TIMEOUT_MS = 2000
const DEFAULT_MAX_FINDINGS = 10_000
const CONTEXT_CHUNK = 4_000
const REQUIRES_ACTION: ReadonlySet<PolicyAction> = new Set(['redact', 'review', 'block'])
const SEMANTIC_RISK_NOTE =
  'Redaction removes only the values PromptVault detected. Surrounding context may still reveal sensitive information, and undetected formats are not covered.'

const RawFindingSchema = z.object({
  category: z.enum(CATEGORIES),
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(1),
  severity: z.enum(SEVERITIES),
  confidence: z.number().min(0).max(1),
  detectorId: z.string().min(1).max(80),
  detectorVersion: z.string().min(1).max(20),
  reasonCode: z.string().min(1).max(60),
  recommendedAction: z.enum(['redact', 'review', 'retain', 'block']),
  label: z.string().max(80),
  explanation: z.string().max(300),
  placeholderType: z.string().regex(/^[A-Z][A-Z0-9_]{0,30}$/),
  source: z.enum(['deterministic', 'contextual', 'custom']),
})

const ScanOptionsSchema = z.object({
  timeoutMs: z.number().finite().max(30_000).optional(),
  maxFindings: z.number().int().min(1).max(20_000).optional(),
  faultInjection: z.object({ failDetectorId: z.string().min(1).max(80) }).optional(),
  retainedFindingIds: z.array(z.string().max(20)).max(20_000).optional(),
})

/** Errors that mean some content may not have been inspected: the scan is not complete. */
const DEGRADING_ERRORS: ReadonlySet<EngineError['code']> = new Set([
  'DETECTOR_FAILURE',
  'SCAN_TIMEOUT',
  'POLICY_INVALID', // a configured custom rule could not be compiled
  'INVALID_FINDING_RANGE', // a detector produced an unusable finding
  'FINDINGS_TRUNCATED',
])

const now = (): number => (globalThis.performance?.now ? globalThis.performance.now() : Date.now())

// ---------- scan ----------

export function scan(req: ScanRequest): ScanResult {
  const started = now()
  const parsed = parsePolicy(req.policy)
  if (!parsed.ok) return failedResult(req, started, [parsed.error], 'block')
  const policy = parsed.policy

  if (typeof req.text !== 'string') {
    return failedResult(req, started, [err('UNSUPPORTED_INPUT', 'Input must be text.')], policy.onScanFailure, policy)
  }
  if (req.text.length > MAX_INPUT_CHARS) {
    const msg = `Input exceeds the ${MAX_INPUT_CHARS.toLocaleString('en-US')} character limit.`
    return failedResult(req, started, [err('INPUT_TOO_LARGE', msg)], policy.onScanFailure, policy)
  }

  const opts = ScanOptionsSchema.safeParse(req.options ?? {})
  if (!opts.success) {
    return failedResult(req, started, [err('UNSUPPORTED_INPUT', 'Scan options are invalid.')], policy.onScanFailure, policy)
  }

  try {
    return runScan({ ...req, options: opts.data }, policy, started)
  } catch {
    // Unexpected engine fault: never surface as a clean result.
    const e = err('DETECTOR_FAILURE', 'The scan engine failed unexpectedly.')
    return failedResult(req, started, [e], policy.onScanFailure, policy)
  }
}

function runScan(req: ScanRequest, policy: Policy, started: number): ScanResult {
  const opts = req.options ?? {}
  const deadline = started + (opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const custom = buildCustomDetectors(policy.customRules.filter((r) => r.enabled))
  const detectors = [...BUILTIN_DETECTORS, ...custom.detectors]

  const run = runDetectors(req.text, detectors, {
    deadline,
    failDetectorId: opts.faultInjection?.failDetectorId,
    now,
  })
  const errors: EngineError[] = [...custom.errors, ...run.errors]
  const versions: Record<string, string> = { ...run.versions }
  let raw = run.raw

  if (run.timedOut) errors.push(err('SCAN_TIMEOUT', 'Detection exceeded its time budget; results are partial.'))

  if (policy.contextualAnalysis && !run.timedOut && now() <= deadline) {
    const ctx = runContextAnalyzer(req.text, opts, deadline)
    raw = [...raw, ...ctx.findings]
    errors.push(...ctx.errors)
    versions[compromiseAnalyzer.id] = compromiseAnalyzer.version
  }

  const maxFindings = opts.maxFindings ?? DEFAULT_MAX_FINDINGS
  const all = reconcile(raw, Number.MAX_SAFE_INTEGER)
  const findings = all.length > maxFindings ? all.slice(0, maxFindings) : all
  if (findings.length < all.length) {
    errors.push(err('FINDINGS_TRUNCATED', `More than ${maxFindings} findings; results are partial.`))
  }
  const status = scanStatus(errors, detectors.length)
  const risk = status === 'completed' ? computeRisk(findings) : null
  const evaluation = evaluatePolicy(findings, policy, {
    scanStatus: status,
    retainedFindingIds: opts.retainedFindingIds ?? [],
    riskBand: risk?.band ?? null,
  })

  return {
    requestId: req.requestId,
    status,
    findings,
    riskScore: risk?.score ?? null,
    riskBand: risk?.band ?? null,
    ...evaluation,
    detectorVersions: versions,
    errors,
    durationMs: round(now() - started),
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    coreVersion: CORE_VERSION,
  }
}

/** Splits text into chunks of at most CONTEXT_CHUNK chars, preferring sentence or line boundaries. */
export function contextChunks(text: string): Span[] {
  const spans: Span[] = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(text.length, start + CONTEXT_CHUNK)
    if (end < text.length) {
      const window = text.slice(start + CONTEXT_CHUNK / 2, end)
      // Prefer a line break, then a sentence end, then any space, so names are not split across chunks.
      const cut = [window.lastIndexOf('\n'), window.lastIndexOf('. '), window.lastIndexOf(' ')].find((i) => i >= 0)
      if (cut !== undefined) end = start + CONTEXT_CHUNK / 2 + cut + 1
    }
    spans.push({ start, end })
    start = end
  }
  return spans
}

/**
 * Optional, advisory analyzer, run chunk by chunk so it respects the scan deadline. Its failure or a
 * budget cut-off is reported but leaves deterministic results (and the scan status) intact.
 */
function runContextAnalyzer(
  text: string,
  opts: ScanOptions,
  deadline: number,
): { findings: RawFinding[]; errors: EngineError[] } {
  const id = compromiseAnalyzer.id
  try {
    const fail = opts.faultInjection?.failDetectorId
    if (fail === id || fail === '*') throw new Error('fault injection')
    const findings: RawFinding[] = []
    const errors: EngineError[] = []
    let dropped = 0
    for (const chunk of contextChunks(text)) {
      if (now() > deadline) {
        const pct = Math.round((chunk.start / text.length) * 100)
        errors.push(err('CONTEXT_ANALYZER_FAILURE', `Name analysis covered ${pct}% of the text within the time budget.`, id))
        break
      }
      const slice = text.slice(chunk.start, chunk.end)
      for (const item of compromiseAnalyzer.analyze(slice) as unknown[]) {
        const res = RawFindingSchema.safeParse(item)
        const valid = res.success && res.data.endOffset <= slice.length && res.data.startOffset < res.data.endOffset
        if (!valid) dropped++
        else {
          const { startOffset, endOffset } = res.data
          findings.push({ ...res.data, startOffset: startOffset + chunk.start, endOffset: endOffset + chunk.start, source: 'contextual' })
        }
      }
    }
    if (dropped) {
      errors.push(err('CONTEXT_ANALYZER_FAILURE', `${dropped} contextual finding(s) failed schema validation and were dropped.`, id))
    }
    return { findings, errors }
  } catch {
    return {
      findings: [],
      errors: [err('CONTEXT_ANALYZER_FAILURE', 'Contextual analyzer failed; deterministic results only.', id)],
    }
  }
}

function scanStatus(errors: EngineError[], detectorCount: number): ScanResult['status'] {
  const failures = errors.filter((e) => e.code === 'DETECTOR_FAILURE').length
  if (detectorCount > 0 && failures >= detectorCount) return 'failed'
  return errors.some((e) => DEGRADING_ERRORS.has(e.code)) ? 'partial' : 'completed'
}

function failedResult(
  req: ScanRequest,
  started: number,
  errors: EngineError[],
  decision: PolicyAction,
  policy?: Policy,
): ScanResult {
  return {
    requestId: req.requestId,
    status: 'failed',
    findings: [],
    riskScore: null,
    riskBand: null,
    policyDecision: decision,
    findingDecisions: [],
    reasonCodes: ['SCAN_INCOMPLETE', ...errors.map((e) => e.code)],
    mandatoryRulesTriggered: [],
    detectorVersions: {},
    errors,
    durationMs: round(now() - started),
    policyId: policy?.policyId ?? 'invalid',
    policyVersion: policy?.policyVersion ?? 'invalid',
    coreVersion: CORE_VERSION,
  }
}

// ---------- sanitize ----------

export function sanitize(req: SanitizeRequest): SanitizeResult {
  try {
    return runSanitize(req)
  } catch {
    return rejected('failed', [err('POST_SCAN_FAILED', 'Sanitization failed unexpectedly; output not validated.')])
  }
}

function runSanitize(req: SanitizeRequest): SanitizeResult {
  const parsed = parsePolicy(req.policy)
  if (!parsed.ok) return rejected('rejected', [parsed.error])
  const policy = parsed.policy

  const verified = verifySelection(req, policy)
  if (!verified.ok) return rejected('rejected', [verified.error])

  // Redact using the engine's own fresh findings, never caller-supplied subspans or placeholder types.
  const findingIds = dropContainedObfuscation(verified.findings, req.findingIds)
  const redaction = applyRedactions(req.sourceText, verified.findings, findingIds, req.placeholderMode, {
    structured: req.structured ?? true,
  })
  if (!redaction.ok) return rejected('rejected', [redaction.error])

  const sanitizedText = redaction.text
  const retainedValues = retainedValuesOf(req, verified.findings)
  const postScan = scan({
    requestId: `${req.requestId}:post`,
    text: sanitizedText,
    policy,
    options: { ...req.options, retainedFindingIds: [] },
  })
  const postWithRetained = applyRetainedValues(postScan, sanitizedText, retainedValues, policy, req.options)

  const residualFindingIds = postWithRetained.findingDecisions
    .filter((d) => REQUIRES_ACTION.has(d.action))
    .map((d) => d.findingId)
  const leaked = leakedValues(req, redaction.replacements, sanitizedText, retainedValues)
  const errors: EngineError[] = []
  if (postScan.status !== 'completed') {
    errors.push(err('POST_SCAN_FAILED', 'Sanitized output could not be fully re-scanned; it is not marked safe.'))
  }

  const validationPassed = postScan.status === 'completed' && residualFindingIds.length === 0 && leaked === 0
  return {
    status: 'completed',
    sanitizedText,
    replacements: redaction.replacements,
    residualFindingIds,
    postScan: postWithRetained,
    validationPassed,
    residualRiskNotes: residualNotes(req, postWithRetained, residualFindingIds.length, leaked),
    errors,
    ...(req.includeMapping && req.placeholderMode === 'typed' ? { mapping: redaction.mapping } : {}),
  }
}

type Verified = { ok: true; findings: Finding[] } | { ok: false; error: EngineError }

/** FR-019: selected findings must match a fresh scan of the same source text exactly. */
function verifySelection(req: SanitizeRequest, policy: Policy): Verified {
  const fresh = scan({ requestId: `${req.requestId}:verify`, text: req.sourceText, policy, options: req.options })
  if (fresh.status === 'failed') {
    return { ok: false, error: err('POST_SCAN_FAILED', 'Source text could not be re-verified before redaction.') }
  }
  const key = (f: Finding) => `${f.findingId}|${f.category}|${f.startOffset}|${f.endOffset}`
  const freshKeys = new Set(fresh.findings.map(key))
  const byId = new Map(req.findings.map((f) => [f.findingId, f]))
  const stale = req.findingIds.some((id) => {
    const f = byId.get(id)
    return !f || !freshKeys.has(key(f))
  })
  if (stale) {
    const msg = 'Selected findings are stale or do not match the source text. Re-scan first.'
    return { ok: false, error: err('INVALID_FINDING_RANGE', msg) }
  }
  return { ok: true, findings: fresh.findings }
}

/** Invisible-character signals inside another selected span are removed with that span; selecting both is not an overlap. */
function dropContainedObfuscation(findings: Finding[], ids: string[]): string[] {
  const idSet = new Set(ids)
  const selected = findings.filter((f) => idSet.has(f.findingId))
  const contained = (o: Finding) =>
    selected.some((f) => f !== o && f.category !== 'obfuscation' && f.startOffset <= o.startOffset && o.endOffset <= f.endOffset)
  const drop = new Set(selected.filter((f) => f.category === 'obfuscation' && contained(f)).map((f) => f.findingId))
  return ids.filter((id) => !drop.has(id))
}

function retainedValuesOf(req: SanitizeRequest, findings: Finding[]): Set<string> {
  const retained = new Set(req.options?.retainedFindingIds ?? [])
  const selected = new Set(req.findingIds)
  return new Set(
    findings
      .filter((f) => retained.has(f.findingId) && !selected.has(f.findingId))
      .map((f) => req.sourceText.slice(f.startOffset, f.endOffset)),
  )
}

/** Carry user retain decisions into the post-scan by value (offsets change after redaction). */
function applyRetainedValues(
  post: ScanResult,
  text: string,
  retainedValues: Set<string>,
  policy: Policy,
  options: ScanOptions | undefined,
): ScanResult {
  if (retainedValues.size === 0 || post.status !== 'completed') return post
  const ids = post.findings
    .filter((f) => retainedValues.has(text.slice(f.startOffset, f.endOffset)))
    .map((f) => f.findingId)
  if (ids.length === 0) return post
  return scan({ requestId: post.requestId, text, policy, options: { ...options, retainedFindingIds: ids } })
}

/** Redaction invariant: a replaced value must not survive anywhere in the output (unless retained). */
function leakedValues(
  req: SanitizeRequest,
  replacements: SanitizeResult['replacements'],
  output: string,
  retained: Set<string>,
): number {
  const values = new Set(replacements.map((r) => req.sourceText.slice(r.start, r.end)))
  let leaked = 0
  for (const v of values) if (v.length >= 3 && !retained.has(v) && output.includes(v)) leaked++
  return leaked
}

const count = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`

function residualNotes(req: SanitizeRequest, post: ScanResult, residual: number, leaked: number): string[] {
  const notes: string[] = []
  if (residual > 0) notes.push(`${count(residual, 'finding')} in the sanitized text still ${residual === 1 ? 'requires' : 'require'} action under the current policy.`)
  if (leaked > 0) notes.push(`${count(leaked, 'redacted value')} still ${leaked === 1 ? 'appears' : 'appear'} elsewhere in the text (unselected occurrences).`)
  const advisory = post.findingDecisions.filter((d) => d.action === 'warn').length
  if (advisory > 0) notes.push(`${count(advisory, 'lower-risk finding')} ${advisory === 1 ? 'remains and is' : 'remain and are'} permitted with a warning.`)
  const unselected = req.findings.length - req.findingIds.length
  if (unselected > 0) notes.push(`${count(unselected, 'finding')} ${unselected === 1 ? 'was' : 'were'} not selected for redaction.`)
  if (post.status !== 'completed') notes.push('Post-redaction scan was incomplete; the output is not validated.')
  notes.push(SEMANTIC_RISK_NOTE)
  return notes
}

function rejected(status: 'rejected' | 'failed', errors: EngineError[]): SanitizeResult {
  return {
    status,
    sanitizedText: null,
    replacements: [],
    residualFindingIds: [],
    postScan: null,
    validationPassed: false,
    residualRiskNotes: [SEMANTIC_RISK_NOTE],
    errors,
  }
}

// ---------- helpers ----------

function err(code: EngineError['code'], message: string, detectorId?: string): EngineError {
  return detectorId ? { code, message, detectorId } : { code, message }
}

function round(ms: number): number {
  return Math.round(ms * 100) / 100
}
