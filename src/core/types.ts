/**
 * PromptVault domain contracts (PRD §11). Framework-free: no React, DOM or Node imports.
 *
 * Offset convention: all offsets are UTF-16 code-unit indices into the ORIGINAL input string,
 * half-open [startOffset, endOffset). Detectors that run on normalized text must map back.
 */
import { z } from 'zod'

export const CORE_VERSION = '1.0.0'
export const MAX_INPUT_CHARS = 100_000

// ---------- Categories ----------

export const CATEGORIES = [
  'email',
  'phone',
  'person_name',
  'ip_address',
  'gov_id',
  'financial',
  'health',
  'credential', // passwords, generic API keys, bearer tokens, JWTs
  'cloud_credential', // provider-specific keys (AWS, GCP, Azure, Stripe, GitHub, Slack, OpenAI...)
  'private_key',
  'crypto_seed',
  'db_connection',
  'custom', // user / org defined rules
  'obfuscation', // zero-width / unusual unicode signal (never auto-redacted text, advisory)
] as const
export type Category = (typeof CATEGORIES)[number]

export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
export type Severity = (typeof SEVERITIES)[number]
export const SEVERITY_SCORE: Record<Severity, number> = { low: 25, medium: 50, high: 80, critical: 100 }

export const ACTIONS = ['allow', 'warn', 'redact', 'review', 'block'] as const
export type PolicyAction = (typeof ACTIONS)[number]
/** Higher index = stricter. Used to aggregate decisions. */
export const ACTION_PRECEDENCE: Record<PolicyAction, number> = { allow: 0, warn: 1, redact: 2, review: 3, block: 4 }

export type RecommendedAction = 'redact' | 'review' | 'retain' | 'block'

// ---------- Findings ----------

export interface Span {
  start: number
  end: number
}

export interface Finding {
  findingId: string // deterministic: `f-${index}` after reconciliation, ordered by startOffset
  category: Category
  startOffset: number
  endOffset: number
  severity: Severity
  confidence: number // [0,1]; likelihood finding belongs to category. NOT severity.
  detectorId: string // e.g. "secret.aws-access-key"
  detectorVersion: string // semver
  reasonCode: string // e.g. "PROVIDER_SIGNATURE", "LUHN_VALID", "LABEL_CONTEXT"
  recommendedAction: RecommendedAction
  label: string // human-readable type, e.g. "AWS access key ID"
  explanation: string // why it fired; MUST NOT contain the raw matched value
  placeholderType: string // e.g. "AWS_KEY", "EMAIL" -> [AWS_KEY_1]
  /** Optional sub-ranges (absolute offsets) holding the actual secret, for structured redaction
   *  (e.g. only the password inside a connection string). */
  sensitiveSubspans?: Span[]
  /** Other detectors that matched the same/overlapping span (provenance after reconciliation). */
  mergedDetectorIds?: string[]
  /** Set by context analyzers: advisory, never authoritative. */
  source: 'deterministic' | 'contextual' | 'custom'
}

/** A raw detector hit before reconciliation (no findingId yet). */
export type RawFinding = Omit<Finding, 'findingId'>

// ---------- Detector rule contract ----------

export interface DetectorContext {
  /** Original text. */
  text: string
}

export interface Detector {
  id: string
  version: string
  category: Category
  description: string
  /** Synthetic positive & negative examples; each detector's unit test asserts these. */
  examples: { positive: string[]; negative: string[] }
  detect(ctx: DetectorContext): RawFinding[]
}

// ---------- Context analyzer (optional local model / NLP) ----------

export interface ContextAnalyzer {
  id: string
  version: string
  /** Must be pure + local. Output is validated by the engine with RawFindingSchema; invalid output is dropped and reported. */
  analyze(text: string): RawFinding[]
}

// ---------- Policy ----------

export const PolicyRuleSchema = z.object({
  category: z.enum(CATEGORIES),
  action: z.enum(ACTIONS),
  minConfidence: z.number().min(0).max(1),
  /** Mandatory rules cannot be overridden by user retain decisions (FR-025). */
  mandatory: z.boolean(),
})
export type PolicyRule = z.infer<typeof PolicyRuleSchema>

export const CustomRuleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().min(1).max(60),
  kind: z.enum(['keyword', 'regex']),
  pattern: z.string().min(1).max(200),
  caseSensitive: z.boolean(),
  severity: z.enum(SEVERITIES),
  placeholderType: z.string().regex(/^[A-Z][A-Z0-9_]{0,24}$/),
  enabled: z.boolean(),
})
export type CustomRule = z.infer<typeof CustomRuleSchema>

export const PolicySchema = z.object({
  policyId: z.string().min(1).max(40),
  policyVersion: z.string().min(1).max(20),
  name: z.string().min(1).max(60),
  mode: z.enum(['strict', 'permissive']),
  rules: z.array(PolicyRuleSchema),
  /** Action for categories without a rule. */
  defaultAction: z.enum(ACTIONS),
  /** Action for findings below their rule's minConfidence (reported as uncertain). */
  lowConfidenceAction: z.enum(['allow', 'warn', 'review']),
  onScanFailure: z.enum(['block', 'warn']),
  postRedactionValidationRequired: z.literal(true),
  contextualAnalysis: z.boolean(),
  customRules: z.array(CustomRuleSchema).max(50),
})
export type Policy = z.infer<typeof PolicySchema>

// ---------- Errors (PRD §11.5) ----------

export type ErrorCode =
  | 'INPUT_TOO_LARGE'
  | 'UNSUPPORTED_INPUT'
  | 'SCAN_TIMEOUT'
  | 'DETECTOR_FAILURE'
  | 'INVALID_FINDING_RANGE'
  | 'POLICY_INVALID'
  | 'POST_SCAN_FAILED'
  | 'CONTEXT_ANALYZER_FAILURE'
  | 'FINDINGS_TRUNCATED'

export interface EngineError {
  code: ErrorCode
  message: string // MUST NOT contain prompt content
  detectorId?: string
}

// ---------- Scan ----------

export interface ScanOptions {
  timeoutMs?: number // default 2000
  maxFindings?: number // default 500
  /** Demo/test only: force a detector (by id, or "*" for all) to throw. */
  faultInjection?: { failDetectorId: string }
  /** Findings the user chose to retain (FR-016). Ignored for mandatory rules. */
  retainedFindingIds?: string[]
}

export interface ScanRequest {
  requestId: string
  text: string
  policy: Policy
  options?: ScanOptions
}

export type RiskBand = 'none' | 'low' | 'medium' | 'high' | 'critical'

export interface FindingDecision {
  findingId: string
  action: PolicyAction
  reasonCode: string // e.g. "RULE_MATCH", "BELOW_MIN_CONFIDENCE", "USER_RETAINED", "DEFAULT_ACTION"
  mandatory: boolean
  retained: boolean
}

export interface ScanResult {
  requestId: string
  status: 'completed' | 'partial' | 'failed'
  findings: Finding[]
  riskScore: number | null // null when scan not trustworthy
  riskBand: RiskBand | null
  policyDecision: PolicyAction
  findingDecisions: FindingDecision[]
  reasonCodes: string[] // aggregate, deduplicated
  mandatoryRulesTriggered: string[] // e.g. ["private_key:block"]
  detectorVersions: Record<string, string>
  errors: EngineError[]
  durationMs: number
  policyId: string
  policyVersion: string
  coreVersion: string
}

// ---------- Sanitize ----------

export type PlaceholderMode = 'typed' | 'mask'

export interface SanitizeRequest {
  requestId: string
  sourceText: string
  findings: Finding[] // from the scan of sourceText
  findingIds: string[] // which findings to redact
  placeholderMode: PlaceholderMode
  policy: Policy
  /** Structured redaction: replace only sensitiveSubspans when present (e.g. keep DB host). Default true. */
  structured?: boolean
  /** Return transient placeholder->original mapping for opt-in restoration. Default false. */
  includeMapping?: boolean
  options?: ScanOptions
}

export interface Replacement {
  findingId: string
  placeholder: string
  start: number // original offsets replaced
  end: number
}

export interface SanitizeResult {
  status: 'completed' | 'rejected' | 'failed'
  sanitizedText: string | null
  replacements: Replacement[]
  /** Findings in the post-scan of sanitized text that still require action. */
  residualFindingIds: string[]
  postScan: ScanResult | null
  validationPassed: boolean
  /** Human-readable residual-risk notes (always includes the semantic-risk disclaimer). */
  residualRiskNotes: string[]
  errors: EngineError[]
  /** Only when includeMapping. Transient; never persisted or sent anywhere. */
  mapping?: Record<string, string>
}
