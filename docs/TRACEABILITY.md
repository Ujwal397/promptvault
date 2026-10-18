# PRD traceability

Each PRD requirement below is mapped to its implementation and the evidence that verifies it (PRD §5: "a requirement is not complete merely because a code path exists"). Product UI requirements are out of scope until the UI is built.

Legend: ✅ implemented and tested · ◐ partially implemented (gap stated) · ⏳ not yet built

## Scanning and detection

| ID | Pri | Status | Implementation | Evidence |
|---|---|---|---|---|
| FR-001 | P0 | ✅ | `core/engine.ts` `scan()`, with no network or paid API | `engine.test.ts`; `e2e/privacy.spec.ts` (offline test) |
| FR-002 | P0 | ✅ | `detectors/pii/*` patterns + `context/compromiseAnalyzer.ts` | `pii.test.ts`, `compromiseAnalyzer.test.ts`, eval gate |
| FR-003 | P0 | ✅ | `detectors/secrets/*` (provider formats, assignments, PEM, seeds, DB URIs) | `secrets/*.test.ts`, eval gate (credential recall ≥ 95%) |
| FR-004 | P0 | ✅ | `Finding` contract in `types.ts` | `engine.test.ts`, `fuzz.test.ts` (range and confidence invariants) |
| FR-005 | P0 | ✅ | multi-finding pipeline | mixed corpus cases |
| FR-006 | P0 | ✅ | `reconcile.ts`: deterministic source/severity/confidence ordering | `reconcile.test.ts` (fast-check property) |
| FR-007 | P1 | ✅ | `governance/rules.manifest.json`: versions, owner, changelog, fingerprints | `governance/manifest.test.ts` (fails on a change without a version bump) |
| FR-008 | P1 | ◐ | `ContextAnalyzer` interface, schema-validated and advisory | `engine.test.ts`. The NLP library is pluggable, but no ML model is integrated |
| FR-009 | P0 | ✅ | separate `confidence` and `severity`; below-threshold findings handled distinctly | `evaluate.test.ts` |
| FR-010 | P0 | ✅ | `failed`/`partial` statuses; fault injection | `engine.test.ts` "failure handling", `scanClient.test.ts` (worker timeout/crash) |

## Sanitization and redaction

| ID | Pri | Status | Implementation | Evidence |
|---|---|---|---|---|
| FR-011 | P0 | ✅ | `redaction/redact.ts` | `redact.test.ts` (property: text outside spans preserved) |
| FR-012 | P0 | ✅ | `sanitize()` with all actionable ids | `engine.test.ts`, eval redaction success |
| FR-013 | P0 | ✅ | `redaction/placeholders.ts` (typed, consistent, anti-spoofing numbering) | `placeholders.test.ts`, `engine.test.ts` |
| FR-014 | P0 | ✅ | span-only replacement, structured DB redaction | `redact.test.ts` (whitespace/indentation) |
| FR-015 | P0 | ✅ | post-scan plus a leaked-value invariant before `validationPassed` | `engine.test.ts`, `fuzz.test.ts` |
| FR-016 | P1 | ✅ | `retainedFindingIds` | `engine.test.ts` "retain decisions" |
| FR-017 | P1 | ✅ | `restorePlaceholders` (opt-in mapping, issued placeholders only) | `restore.test.ts` |
| FR-018 | P0 | ✅ | the core never submits anything; there is no submission path | architecture; no network API exists in the core |
| FR-019 | P0 | ✅ | `verifySelection` re-scans; rejects stale/overlapping/out-of-range spans | `engine.test.ts`, `redact.test.ts` |
| FR-020 | P0 | ✅ | `residualFindingIds` + `residualRiskNotes` (always includes a semantic-risk note) | `engine.test.ts` |

## Policy and risk

| ID | Pri | Status | Implementation | Evidence |
|---|---|---|---|---|
| FR-021 | P0 | ✅ | `policy/scoring.ts` (`SCORING_VERSION`) | `scoring.test.ts` |
| FR-022 | P0 | ✅ | five decisions | `evaluate.test.ts` |
| FR-023 | P0 | ✅ | `reasonCodes`, `mandatoryRulesTriggered`, per-finding decisions | `evaluate.test.ts` |
| FR-024 | P1 | ✅ | user policies (`parsePolicy`) + signed org bundles (`policy/bundle.ts`) | `parse.test.ts`, `bundle.test.ts` |
| FR-025 | P1 | ✅ | mandatory rules can't be retained (even below confidence); the secret safety floor is enforced on every policy | `engine.test.ts` "review regressions", `parse.test.ts` "secret safety floor" |
| FR-026 | P0 | ✅ | `EventRecord.kind`: `simulation` vs `submission` | `events.test.ts` |

## Privacy and observability

| ID | Pri | Status | Implementation | Evidence |
|---|---|---|---|---|
| FR-027 | P0 | ✅ | no logging in the core; explanations and errors never contain values | `engine.test.ts` (explanations), `fuzz.test.ts`, `runEval.test.ts` (masking) |
| FR-028 | P1 | ✅ | `events/` (opt-in, counts only, day buckets, retention) | `events.test.ts` (property: no values/offsets serialized) |
| FR-029 | P0 | ✅ | the core has no reporting dependency | architecture |
| FR-030 | P0 | ✅ | CSP `connect-src 'none'` in production builds; egress e2e | `e2e/privacy.spec.ts` (3 browsers), `npm run check:build` |
| FR-031 | P1 | ✅ | detector, policy, scoring, corpus and core versions in every result | manifest test; `ScanResult` fields |

## Non-functional

| Area | Status | Evidence |
|---|---|---|
| Scan latency target (P95 ≤ 300 ms at 10 KB) | ✅ | `engine.test.ts` performance; eval p95 about 2 ms per prompt |
| Input limit 100 KB, ReDoS safety | ✅ | pathological 100k-char tests per detector family; custom-regex validator; worker hard timeout |
| Deterministic results | ✅ | `engine.test.ts`, `fuzz.test.ts` |
| Cross-browser | ✅ | Playwright: Chromium, Firefox, WebKit |
| Supply chain | ✅ | pinned deps, `npm audit`, license allowlist, SBOM, reproducible-build check, gitleaks in CI |
| Coverage | ✅ | `npm run test:coverage` (gate: 85% lines / 80% branches) |
| Browser extension (Stage 3) | ⏳ | the core is framework-free and ready; no adapter yet |
| Local ML model evaluation (§6.5) | ⏳ | interface only; see `docs/LIMITATIONS.md` |
