# PromptVault MVP: Build Spec

Condensed from `docs/reference/PromptVault_PRD_v1.0.pdf`. The contracts live in `src/core/types.ts`; **do not change them** without asking the supervisor.

## Product

A privacy-first firewall for AI prompts. It runs entirely in the browser: scan text → findings (category, span, severity, confidence, detector, reason) → risk score + policy decision → redaction with typed placeholders → re-scan of the sanitized output (post-redaction validation). No network calls, no paid APIs, no persistence of prompt text or raw values.

## Hard rules (all modules)

- `src/core/**` is framework-free TypeScript: no React, DOM, `window`, `localStorage`, `fetch`, or Node APIs. Pure functions; never mutate inputs.
- Offsets are UTF-16 indices into the ORIGINAL text, half-open `[start, end)`.
- Never put raw matched values in `explanation`, error messages, or logs. No `console.log`.
- Failures are explicit and must never silently produce a clean/allow result.
- Regexes must be ReDoS-safe: no nested quantifiers, bounded repetition (`{8,256}` rather than `+` on large classes when adjacent to similar classes), and the `g`/`y` flag with `lastIndex` loops. Inputs are capped at 100k chars.
- Confidence ≠ severity. A token-like string is never called a "confirmed" or "live" credential.
- Test fixtures are synthetic only (e.g. `AKIAIOSFODNN7EXAMPLE`, `user@example.com`, `555-0100` numbers, Luhn-valid test cards like 4111 1111 1111 1111).
- Files stay under ~400 lines and functions under ~50; split by domain.
- Tests: Vitest, colocated as `*.test.ts` next to the module. Run with `npx vitest run <path>`.

## Module ownership and exported signatures

### Detection (`src/core/detectors/`, `src/core/normalize.ts`, `src/core/reconcile.ts`, `src/core/context/`)
- `normalize.ts`: `normalizeText(text): { normalized: string; toOriginal(index: number): number; signals: RawFinding[] }`. It strips zero-width and invisible characters (U+200B–U+200D, U+2060, U+FEFF, U+00AD) for detection while keeping an offset map, and emits `obfuscation` findings (low severity) where they occur. It does not rewrite the user's text.
- `detectors/index.ts`:
  - `BUILTIN_DETECTORS: Detector[]`
  - `buildCustomDetectors(rules: CustomRule[]): { detectors: Detector[]; errors: EngineError[] }`. Keyword rules use escaped literals; regex rules are validated and rejected (as an error) if they fail to compile or look ReDoS-prone (nested quantifiers).
  - `runDetectors(text, detectors, opts: { deadline: number; failDetectorId?: string; now?: () => number }): { raw: RawFinding[]; errors: EngineError[]; timedOut: boolean; versions: Record<string,string> }`. It normalizes, runs each detector in try/catch, checks the deadline between detectors, and maps offsets (including `sensitiveSubspans`) back to the original text. `failDetectorId` (`"*"` = all) makes those detectors throw (fault injection).
- `reconcile.ts`: `reconcile(raw: RawFinding[], maxFindings: number): Finding[]`. It is deterministic: it deduplicates identical spans and resolves overlaps (higher severity, then higher confidence, then longer span, then detectorId wins; contained/overlapping losers are recorded in `mergedDetectorIds`; `obfuscation` findings never suppress others and are never suppressed). It assigns `findingId = f-<n>` by start order.
- `context/compromiseAnalyzer.ts`: `compromiseAnalyzer: ContextAnalyzer` (uses the `compromise` npm package for person names, `source: 'contextual'`, confidence ≤ 0.7, severity medium, placeholderType `PERSON`). `context/index.ts` exports it.

### Policy and redaction (`src/core/policy/`, `src/core/redaction/`)
- `policy/presets.ts`: `STRICT_POLICY`, `PERMISSIVE_POLICY`, `POLICY_PRESETS`. Both must pass `PolicySchema`.
- `policy/parse.ts`: `parsePolicy(input: unknown): { ok: true; policy: Policy } | { ok: false; error: EngineError }` (code `POLICY_INVALID`; never falls back to a more permissive policy).
- `policy/scoring.ts`: `computeRisk(findings: Finding[]): { score: number; band: RiskBand }`. `R = min(100, round(max(S×C) + B))`, where B is a bounded bonus (max 15): +5 per additional distinct credential-type finding (credential, cloud_credential, private_key, db_connection, crypto_seed) beyond the first, and +5 if a db_connection has sensitiveSubspans. Obfuscation findings are excluded from the max but add +5 to B if present alongside any other finding. Bands: 0 none, 1–29 low, 30–59 medium, 60–84 high, 85–100 critical. Export `SCORING_VERSION`.
- `policy/evaluate.ts`: `evaluatePolicy(findings, policy, ctx: { scanStatus: ScanResult['status']; retainedFindingIds: string[]; riskBand: RiskBand | null }): { policyDecision; findingDecisions; reasonCodes; mandatoryRulesTriggered }`.
  - A finding uses the rule for its category, or `defaultAction`. If confidence < minConfidence, it gets `lowConfidenceAction` with reason `BELOW_MIN_CONFIDENCE`.
  - A retained finding becomes `allow` (`USER_RETAINED`) unless its rule is mandatory (then `RETAIN_DENIED_MANDATORY`, keeping its action).
  - The aggregate is the strictest action. In strict mode, a `critical` risk band with an aggregate below `redact` raises it to `review` (`STRICT_CRITICAL_RISK`). The score never lowers a mandatory action.
  - If scanStatus ≠ completed, the aggregate is at least `onScanFailure` (`SCAN_INCOMPLETE`).
  - No findings + completed → `allow` (`NO_FINDINGS`).
- `redaction/placeholders.ts` + `redaction/redact.ts`: `applyRedactions(text, findings, findingIds, mode, opts: { structured: boolean }): { ok: true; text; replacements: Replacement[]; mapping: Record<string,string> } | { ok: false; error: EngineError }`.
  - Reject (INVALID_FINDING_RANGE) unknown ids, out-of-range or inverted spans, and selected spans that overlap each other.
  - Apply in descending offset order. In typed mode, `[TYPE_N]` is consistent per identical value and type, distinct values get distinct N, and it skips any N whose placeholder already appears in the source text (anti-spoofing). In mask mode, `[REDACTED_TYPE]`.
  - Structured: if `sensitiveSubspans` exist, replace only those (each gets its own placeholder, type `<placeholderType>_SECRET`, e.g. `[DB_PASSWORD_1]`); otherwise the whole span.
  - Text outside the replaced spans must be byte-identical (property-test with fast-check).
- `redaction/restore.ts`: `restorePlaceholders(text, mapping): { text; restoredCount; unknownPlaceholders: string[] }`. It only restores placeholders present in the mapping and reports placeholder-looking tokens not issued by the mapping as unknown (never restores them).

### Engine (supervisor writes it): `src/core/engine.ts`
`scan(req: ScanRequest): ScanResult` and `sanitize(req: SanitizeRequest): SanitizeResult`. The web app imports only from `src/core/index.ts`.

### Evaluation (`src/core/eval/`)
- `corpus.ts`: `EVAL_CORPUS: EvalCase[]`, `CORPUS_VERSION`. `EvalCase = { id; description; text; expected: { category: Category; value: string; occurrence?: number }[]; expectedDecision: PolicyAction /* under STRICT_POLICY */; tags: ('positive'|'negative'|'adversarial'|'mixed'|'code')[]; split: 'dev'|'heldout' }`. The span is derived from `value` via indexOf (nth occurrence). At least 50 cases cover every category, harmless look-alikes (UUIDs, git SHAs, hex colours, base64 images, version numbers, sensitive words without values), obfuscated variants (zero-width chars, split separators), repeated values, and code/config/log snippets.
- `runEval.ts`: `runEvaluation(cases, deps: { scan(text): ScanResult; sanitize(text, scan): SanitizeResult }): EvalReport`. It reports per-category TP/FP/FN/precision/recall/F1, span accuracy (exact match), policy decision accuracy, redaction success (expected values absent from sanitized text and validationPassed), false block rate on negative cases, latency p50/p95, and per-case outcomes. Matching: a predicted finding matches an expected one if the categories are equal and the spans overlap. `obfuscation` findings are excluded from P/R. Export types `EvalReport`, `CaseOutcome`.

### Web app (`src/ui/`, `src/App.tsx`, `src/main.tsx`)
React 19 + plain CSS (CSS variables, light/dark). Imports the core only via `src/core/index.ts`. Covered later in the UI brief.
