# Development guide

Requires Node.js 20 or newer.

## Run it

```bash
npm ci
npm run dev                          # development server (no CSP, because Vite hot reload needs a websocket)
npm run build && npm run preview     # production build with the CSP; use this to verify privacy claims
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check, then production build (adds the CSP meta tag) |
| `npm run preview` | Serve the production build |
| `npm test` | Unit, property, integration, fuzz and governance tests (Vitest, fast-check) |
| `npm run test:coverage` | Tests with coverage |
| `npm run typecheck` / `npm run lint` | `tsc -b` / oxlint |
| `npm run e2e` | Privacy egress tests in 3 browsers (first run: `npx playwright install`) |
| `npm run eval` | Regression corpus metrics (`-- --blind` for the blind corpus) |
| `npm run fuzz` | Fuzz tests (`FUZZ_RUNS=2000` for more) |
| `npm run check:build` | Verifies the CSP in the build and `public/_headers` agree |
| `npm run check:licenses` / `npm run sbom` | Licence allow-list check / CycloneDX SBOM |
| `npm run docs:detectors` | Regenerates `docs/DETECTORS.md` from code |
| `npm run rules:snapshot` | Updates the detector version manifest after a detector change |
| `npm run policy:sign` | Signs a policy bundle |

## Tech stack

Vite, React 19 and TypeScript for the app; Zod for validation of messages, policies and files; compromise for local, advisory name analysis; `@scure/bip39` for seed phrase checks; Vitest and fast-check for tests; Playwright for privacy tests. No backend and no paid API.

## Project layout

```
src/core/            framework-free security core (reusable by a future browser extension)
  detectors/         pii/ and secrets/ detector families, custom rules
  context/           optional local name analyzer (advisory, schema-validated)
  policy/            presets, parsing and safety floor, scoring, evaluation, signed bundles
  redaction/         placeholders, span replacement, opt-in restoration
  events/            opt-in, privacy-safe aggregate events (counts only)
  governance/        detector version and fingerprint manifest
  eval/              regression corpus, blind corpus, metrics runner
  engine.ts          scan() / sanitize() orchestration, fail-closed
src/adapters/web/    Web Worker, validated message protocol, hard timeout, network lockdown
src/ui/              the app: scan, policy, history, settings, shell, shared state
build/csp.ts         production Content-Security-Policy
e2e/                 privacy harness and Playwright tests
scripts/             eval, docs, build and licence checks, rule snapshot, policy signing
docs/                spec, demo script, detector catalog, threat model, traceability, limitations
```

## Governance

- Changing a detector requires a version bump and `npm run rules:snapshot`; a test enforces it.
- Every detector has synthetic positive and negative examples, and regexes must be ReDoS-safe.
- Never edit `src/core/eval/blind/` to make detectors pass; record runs in its `RESULTS.md`.
- Test fixtures are synthetic only; build token-like strings by concatenation. Secrets belong in git-ignored `.env` files.

## Deployment

PromptVault is a static site. `npm run build` writes `dist/`, which any static host can serve. There is no server component.

`public/_headers` is copied into `dist/` and carries the same Content Security Policy as `build/csp.ts`, plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and a `Permissions-Policy` that disables camera, microphone and geolocation. Netlify and Cloudflare Pages read this file format. `frame-ancestors` can only be set through a response header, so it appears in `_headers` but not in the meta tag. Other hosts need the same headers configured by hand. `npm run check:build` fails if the two CSP definitions drift apart.

## Test and metric detail

- 1,650 tests in 66 files pass. The 27 privacy e2e tests run against a test-only harness page (`e2e/harness/`), not the product UI.
- Regression corpus: 107 synthetic cases, 100% on all metrics; tuning data only.
- Blind corpus run 1: 94.2% precision, 90.7% recall (the only blind result). Later runs: 98.2% precision, 100% recall, tuned. See `src/core/eval/blind/RESULTS.md`.
