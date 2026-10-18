# Blind held-out corpus

Written 2026-10-18 by an isolated AI agent with no access to the detector code,
detector docs, dev corpus, or existing tests (only types, EvalCase, strict policy).
40 cases (16 credential, 12 PII, 12 negative/tricky), all `split: 'heldout'`.
Expected decisions were computed from STRICT_POLICY, not from scanner output.

## FROZEN

Do NOT edit this corpus to make detectors pass, and do not tune detectors against
it without bumping `BLIND_CORPUS_VERSION` in `corpus.ts` and recording the change.

## Change log

- 1.0.0 (2026-10-18): initial version.
