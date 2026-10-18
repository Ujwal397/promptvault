# Known limitations

PromptVault reduces accidental disclosure for **supported formats on tested paths**. It is a working prototype with a production-oriented core, not a certified security product. Everything below is a deliberate, documented boundary (PRD §1, §8.5, §10.5).

## Detection coverage
- **No detector catches everything.** Undetected formats and purely semantic secrets ("our acquisition target is Acme") pass through. See `docs/DETECTORS.md` for exactly what is covered.
- **Jurisdictions:** government IDs cover the US (SSN, ITIN, and EIN/driver's licence by label only), India (Aadhaar, PAN, voter ID), the UK (NINO), Canada (SIN), Australia (TFN), Brazil (CPF), Singapore (NRIC/FIN) and Spain (DNI/NIE). Others are not detected.
- **Name detection:** the local name analyzer (compromise.js plus extra lexicons) is English-oriented and advisory. It recognises common given names, including a bundled lexicon of common non-Anglo given names, and names corroborated by an email address in the same text (for example "Priya" next to priya.sharma@...). A lone, uncorroborated name is still reported as uncertain and can at most warn. Names that are also common English words (such as Hope, Will or Sunny) are deliberately excluded to limit false positives, so those are missed unless labelled. Rare names outside the lexicon, with no label or email nearby, can be missed. Labelled names ("Name:", "Patient:", "Dear ...") are detected in any language that uses Latin capitalisation. Name suggestions are on in Strict and off in Permissive by default.
- **Health data:** limited to labelled record numbers and a dictionary of about 60 common conditions near clinical context words. It does not diagnose and is not exhaustive.
- **Provider keys:** about 40 providers have signature detectors (42 detectors). Unknown providers rely on labelled assignments (`api_key = …`) and a low-confidence entropy heuristic that flags them for review rather than asserting a secret.
- **Glued tokens:** a provider token glued directly to other letters or digits (no separator) is only detected for AWS key IDs (reported as uncertain).
- **Seed phrases:** detected in English BIP39 only.
- **Checksums:** identifiers that fail their checksum are reported as uncertain (review) only when an explicit label is present. Unlabelled typo'd IDs are missed.
- **Never validated:** credentials are never checked against live services, so a finding means "matches the format", not "is a working key".

## Measurement honesty
- The main corpus (107 cases, 100% on all metrics) was written alongside the detectors, and some fixes were driven by its misses. Treat it as a regression suite, not evidence of real-world accuracy.
- The **blind corpus** (40 cases, written by an isolated agent without access to the code) is the independent measurement. First contact: precision 94.2%, recall 90.7%, false-block rate 9.1%. Later runs are tuned (see `src/core/eval/blind/RESULTS.md`). Run 3 and later are tuned, not blind. A fresh, human-written blind corpus is the next step.
- All data is synthetic. Precision on real-world traffic has not been measured.

## Runtime and platform
- **Local storage:** the saved policy (including custom rule terms you type), settings and opt-in activity counts live in the browser's local storage, unencrypted. Anyone with access to the browser profile can read them. Prompt text and placeholder mappings are never stored.
- **The strict CSP applies to production builds only.** The dev server has no CSP; verify privacy claims on `npm run build && npm run preview`, or on a host that serves `public/_headers`.
- **Safari/WebKit logs CSP reports for native dropdowns.** WebKit applies an inline style inside every native `<select>` it creates and reports it as a `style-src-attr` violation, even for a bare `document.createElement('select')` with no app code. These reports come from the browser engine, not the app (app styles never use the style attribute), involve no network request, and the dropdowns work normally. Chromium and Firefox report no violations. The e2e test excuses exactly these `<select>` reports on WebKit and fails on any other violation.
- **Signed policy import** is refused until an organisation adds its public key to `src/ui/policy/trustedKeys.ts` and rebuilds; none ships by default.
- Local processing does not protect against a compromised device, browser or malicious extension, nor against screenshots or clipboard history.
- Once a user sends a sanitized prompt, the AI provider processes it under its own terms. Redaction does not remove context that may still reveal information.
- Very large, name-dense inputs can exhaust the name analyzer's time budget. The scan then reports how much of the text name analysis covered; deterministic results stay complete.
- The scan engine is synchronous inside a Web Worker with a hard timeout (5 s default). On timeout or crash, the worker is terminated and the result fails closed.
- Browser support requires lookbehind and Unicode property escapes (Chrome 64+, Firefox 78+, Safari 16.4+). It is tested on current Chromium, Firefox and WebKit.

## Not built yet
- **Product UI e2e:** the 27 privacy e2e tests drive a test-only harness page, not the product UI. The UI has unit tests but no browser tests yet.
- **Browser extension (PRD Stage 3):** the core is framework-free for reuse; the site adapters do not exist yet.
- **Optional local ML model (PRD §6.5):** only the `ContextAnalyzer` interface exists. No model has been licence-reviewed or benchmarked.
- **Release hardening:** a human penetration test, commit-SHA pinning of CI actions, and continuous fuzzing infrastructure have not been done. Reviews so far were automated (AI reviewer), with all high and medium findings fixed.
