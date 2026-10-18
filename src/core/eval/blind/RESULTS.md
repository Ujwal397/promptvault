# Blind corpus results

The blind corpus (`corpus.ts`, v1.0.0, 40 cases) was written by an isolated agent that had no access to the detector code. Run it with `npm run eval -- --blind`.

## Run 1: first contact (2026-10-18, core v1.0.0, 80 detectors, strict policy)

This is the only truly blind measurement. It is frozen.

| Metric | Value |
|---|---|
| Precision | 94.2% |
| Recall | 90.7% |
| F1 | 92.5% |
| Span accuracy | 95.9% |
| Policy decision accuracy | 97.5% |
| Redaction success | 79.3% |
| False-block rate (harmless cases) | 9.1% (1/11) |
| Latency p50 / p95 | 1.10 ms / 2.53 ms |

| Category | TP | FP | FN | Precision | Recall |
|---|---|---|---|---|---|
| cloud_credential | 10 | 0 | 0 | 100% | 100% |
| credential | 7 | 0 | 0 | 100% | 100% |
| db_connection | 2 | 0 | 0 | 100% | 100% |
| private_key | 1 | 0 | 0 | 100% | 100% |
| email | 9 | 0 | 0 | 100% | 100% |
| ip_address | 2 | 0 | 0 | 100% | 100% |
| phone | 4 | 0 | 1 | 100% | 80% |
| person_name | 10 | 2 | 1 | 83% | 91% |
| financial | 3 | 1 | 0 | 75% | 100% |
| gov_id | 1 | 0 | 2 | 100% | 33% |
| health | 0 | 0 | 1 | n/a | 0% |

Takeaway: credential and secret detection generalised fully to unseen, realistic prompts (20 of 20). PII detection generalised less well. The root causes of the misses are listed in `docs/LIMITATIONS.md`.

## After run 1

The misses above informed general detector fixes, so later runs on this corpus are **tuned, not blind**, and are reported separately below. A new independent corpus (v2) is needed for the next blind measurement.

## Run 2: after general fixes (2026-10-18, 81 detectors): TUNED, not blind

General fixes made after run 1: word-boundary names, card grouping rules, labelled IDs with failed checksums reported as uncertain, UK phone formats, surname extension in the name analyzer, and a health-condition detector with clinical context. The corpus itself was not edited.

| Metric | Run 1 (blind) | Run 2 (tuned) |
|---|---|---|
| Precision | 94.2% | 98.1% |
| Recall | 90.7% | 98.1% |
| Policy accuracy | 97.5% | 95.0% |
| Redaction success | 79.3% | 96.6% |
| False-block rate | 9.1% | 0.0% |

Remaining differences:
- **blind-pii-05 and blind-pii-11:** typo'd or example IDs with an explicit label are now flagged for review, not redaction. This is intended: an uncertain finding never yields a silent allow.
- **blind-pii-03:** "hypertension" in a patient note is reported as health data but was not in the expected list. Arguably correct, but scored as a false positive.
- **blind-pii-02:** an unlabelled name ("Priya Raman") is missed. This is a coverage limit of the compromise NLP library.

## Run 3: name analyzer 1.2.0 (2026-10-18): TUNED, not blind

Change: the compromise name analyzer gained a lexicon of common non-Anglo given names (compromise's built-in list missed names such as "Priya"), and names corroborated by an email address in the same text ("Priya" + priya.sharma@…) score 0.75. The corpus itself was not edited.

| Metric | Run 1 (blind) | Run 2 (tuned) | Run 3 (tuned) |
|---|---|---|---|
| Precision | 94.2% | 98.1% | 98.2% |
| Recall | 90.7% | 98.1% | 100.0% |
| Policy accuracy | 97.5% | 95.0% | 95.0% |
| Redaction success | 79.3% | 96.6% | 100.0% |
| False-block rate | 9.1% | 0.0% | 0.0% |

- **blind-pii-02:** the unlabelled name "Priya Raman" is now found. person_name is 11/11 with no false positives.
- These numbers are from a tuned engine on a corpus whose misses informed the fixes. They are not evidence of real-world accuracy; run 1 remains the only blind result.
