# Threat model

Scope: the standalone web app and the shared security core (PRD §10). Each mitigation names the control that implements it and the test that verifies it.

## Assets
Original prompt text, embedded PII, credentials and keys, placeholder→original mappings, policies and custom rules, event metadata, and release artifacts.

## Trust boundaries
1. **Prompt text** is untrusted input. It is only ever data: never executed, never interpreted as policy.
2. **The worker boundary:** messages crossing between the page and the scan worker are validated with zod on both sides (`adapters/web/protocol.ts`).
3. **The context analyzer** (compromise.js) is a separate, advisory component. Its output is schema-validated and range-checked, and when uncertain it can never escalate beyond `warn` or override a deterministic finding.
4. **Policies:** user-edited policies pass `parsePolicy`, which enforces the secret safety floor. Organization policies must also pass ECDSA P-256 signature verification and a rollback (sequence) check.
5. **The destination AI service** is outside the boundary. PromptVault only prepares text; it never sends it.

## Threats and mitigations

| Threat | Mitigation | Verification |
|---|---|---|
| Prompt leaks via network | No network code in the core; production CSP `connect-src 'none'`; analytics/telemetry absent | `e2e/privacy.spec.ts` (requests recorded, fetch/beacon/WebSocket blocked, offline mode), `check:build` asserts the CSP |
| Prompt leaks via logs/events | No logging in the core; explanations/errors are static strings; events hold enums and counts only | `fuzz.test.ts`, `events.test.ts` property, `runEval.test.ts` masking |
| Secret missed (false negative) | Layered detectors (signatures, checksums, labels, entropy as supporting evidence, split-token rejoin, invisible-char and homoglyph normalization); strict policy reviews uncertain findings | per-detector tests, eval gate, blind corpus, fuzzing |
| Redaction range error | Engine re-verifies findings against a fresh scan; descending replacement; overlap rejection; post-scan plus leaked-value invariant | `redact.test.ts` property, `engine.test.ts`, `fuzz.test.ts` |
| Fail-open on error | `failed`/`partial` statuses; strict policy blocks; worker timeout/crash → failed result; degraded statuses for bad custom rules, dropped findings and truncation | `engine.test.ts` "failure handling" and "review regressions", `scanClient.test.ts` |
| Regex DoS | Bounded patterns; 100k-char pathological tests; custom regexes limited to bounded quantifiers with a backtracking budget; the worker is terminated at the hard timeout | `detectors/index.test.ts`, `regression.test.ts`, `scanClient.test.ts` |
| Placeholder spoofing during restoration | Numbering skips placeholders already in the source; restore only replaces issued placeholders and reports unknown ones; restore is opt-in and the mapping is in-memory only | `placeholders.test.ts`, `restore.test.ts` |
| Policy downgrade / malicious config | Safety floor on every policy; signed bundles with key allowlist, sequence-based rollback protection, expiry | `parse.test.ts`, `bundle.test.ts` |
| User rule shadows a mandatory finding | Reconciliation ranks deterministic findings above custom/contextual ones | `engine.test.ts` "review regressions" |
| Obfuscation (zero-width, bidi, homoglyphs) | Normalization strips format characters and folds confusables for detection only, with an offset map; obfuscation signal raised | `normalize.test.ts`, `regression.test.ts` |
| Credential validation side effects | Never performed: no network access exists | architecture |
| Supply-chain compromise | Exact-pinned deps, `npm ci --ignore-scripts`, audit, license allowlist, SBOM, reproducible build, gitleaks | CI workflow |

## Residual risks (accepted, documented)
- A compromised device, browser or extension can read the prompt before PromptVault sees it.
- Undetected formats and purely semantic secrets ("our Q3 acquisition target is…") are not covered. See `LIMITATIONS.md`.
- Sanitized prompts may still reveal information through context.
- The destination AI service processes whatever the user finally sends.
- GitHub Actions in CI are pinned to version tags, not commit SHAs (hardening task before production).
