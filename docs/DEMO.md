# Hackathon demo script (3 to 4 minutes)

Follows the PRD section 17 plan: harmless scan, credentials in code, PII plus a custom internal ID, redaction, re-scan, an adversarial case, privacy evidence, fault simulation.

All example data is synthetic. The key-like strings contain "EXAMPLE" or "demo" and are not real credentials. Every prompt below was run through the scan engine with the settings in the setup, and produced the findings listed.

## Setup (before you go on stage)

1. Demo the production build, not the dev server. The CSP meta tag only exists in production builds.
   ```bash
   npm ci
   npm run build && npm run preview
   ```
   Open the printed address (normally http://localhost:4173) in Chrome or Edge.
2. Start from a clean state: Settings, Clear everything, confirm. Then check Scan is on **Strict** and Settings, Redaction, is on **Labelled** (typed placeholders; the restore step needs them) with **Spot names** on (Strict turns it on by default).
3. Add the two custom rules for step 3, once. Policy tab, Add rule:
   - Name `Internal order ID`, match type Pattern (regular expression), expression `INT-[0-9]{4,8}`, placeholder type `ORDER_ID`.
   - Name `Codename`, match type Keyword, expression `Project Bluebird`, placeholder type `CODENAME`.
   - Press **Save policy**. The rules are stored in the browser's local storage, so this survives a reload.
4. Settings, Activity: turn **Record activity** on if you want History to have something to show (optional; the script does not depend on it).
5. Have a second, empty text file or notes window ready for the step 5 paste. Keep DevTools closed until step 6.
6. Optional, for the zero-width variant in step 5, run this in PowerShell to put the test string on the clipboard:
   ```powershell
   Set-Clipboard ("my key is AKIA" + [char]0x200B + "IOSFODNN7EXAMPLE and email jane.doe" + [char]0x200B + "@example.com please check")
   ```

## Script

### 1. Harmless prompt (0:00 to 0:25)

**Paste into Scan:**
```
Please summarise the key trade-offs between REST and GraphQL for a small team, in five bullet points.
```
**Click:** Scan prompt.

**Audience sees:** the scan finishes almost instantly and nothing needs attention. The result is allow, risk none, and the sanitized text equals the input.

**Say:** "A normal prompt passes untouched. It only gets in your way when there is something to protect."

**If it fails:** "A scan that cannot finish never reads as clean. That is the fail-closed design, and I will show it on purpose in a minute."

### 2. Credentials in code (0:25 to 1:00)

**Click:** Edit prompt (or Back to Write), clear the box, paste:
```
Why does this fail with 403?

import boto3
AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
DATABASE_URL = "postgres://demo_user:demo-password-123@db.example.com:5432/orders"
client = boto3.client("s3")
```
**Click:** Scan prompt.

**Audience sees:** the Review step with an ember-tinted background and a critical risk line (score 100). Three findings: an AWS access key ID, an AWS secret key and a database connection string. Each is marked as always removed (locked, no checkbox to untick). Values are masked.

**Say:** "These are mandatory. No policy setting and no checkbox lets a credential through; this is the safety floor."

**If it fails:** "If a detector had failed, you would see a blocked result instead. Either way it never silently passes."

### 3. PII plus a custom internal ID (1:00 to 1:40)

**Click:** Edit prompt, clear the box, paste:
```
Draft a reply to our customer Priya Sharma (priya.sharma@example.com, +1 415 555 0132). Her order INT-48213 was delayed. Her SSN on file is 123-45-6789 and Project Bluebird is the internal codename.
```
**Click:** Scan prompt.

**Audience sees:** six findings, medium-high risk with a review decision: person name (labelled Suggestion, from the on-device name analyzer), email, phone, US SSN, the order ID and the codename (both labelled as custom rules). The SSN is locked; the others have checkboxes.

**Say:** "Standard detectors cover the common formats. The two rules I added on the Policy tab cover what only my company knows. The name is a suggestion because the on-device language analyzer is advisory; the email address next to it is what makes it confident."

**If the name is missing:** "Name detection is deliberately conservative and advisory. The deterministic detectors are the authority." (The other five findings still show.)

### 4. Redaction (1:40 to 2:05)

**Click:** Redact 6 items (the button shows the count of ticked items).

**Audience sees:** the Sanitized step with a sage-tinted background and "Ready to send". Black redaction bars replace each value. Click **Compare** to show before and after. The copied text uses the labels:
```
Draft a reply to our customer [PERSON_1] ([EMAIL_1], [PHONE_1]). Her order [ORDER_ID_1] was delayed. Her SSN on file is [SSN_1] and [CODENAME_1] is the internal codename.
```
**Say:** "Typed placeholders keep the sentence useful to the AI while the values never leave this tab."

### 5. Re-scan and restore (2:05 to 2:30)

**Audience sees:** the line stating that the re-scan found nothing left. Point at it.

**Say:** "I do not trust my own redaction. The output is scanned again, and if anything is left it is listed here instead of claiming success."

**Optional, 20 seconds:** in the Got a reply? card, paste this fake AI reply and click **Restore reply**:
```
Hi [PERSON_1], sorry about the delay on [ORDER_ID_1]. We have emailed [EMAIL_1] with a new date.
```
The real name, order ID and email appear again. **Say:** "The mapping lives in memory only. Close the tab and it is gone."

### 6. Adversarial case (2:30 to 3:00)

Go back to Write, clear, and paste a key split over two lines:
```
Here is the key split over two lines:
key: AKIAIOSFODNN7
EXAMPLE
```
(Or paste the zero-width string from setup step 6.) Scan, then redact.

**Audience sees:** the split key is found as one credential and redacted to `[AWS_ACCESS_KEY_1]`. With the zero-width string you also see Obfuscation findings for the hidden characters, an access key and the email, all redacted.

**Say:** "Attackers and sloppy formatting split or disguise secrets. We normalise hidden characters and join split tokens before detection." Then optionally run Settings, Testing, **Run suite** (Regression) and show the report; if you choose Blind, say out loud that the engine was tuned after run 1.

**If something is missed:** "No detector catches everything. That is in our Limitations doc and it is why Strict mode exists." Do not pretend otherwise.

### 7. Privacy evidence (3:00 to 3:35)

1. Open DevTools, **Network** tab, tick Preserve log, clear it. Go back to Scan, paste any prompt from above and scan and redact. **Audience sees:** no requests appear. (Reloading the page shows the normal static file loads, which is expected; the point is that scanning adds nothing.)
2. DevTools, **Elements**, expand `<head>`: show `<meta http-equiv="Content-Security-Policy" ...>` containing `connect-src 'none'`.
3. Settings, **Privacy**: read the facts. Network connections blocked by the CSP in production; scanning runs in a Web Worker with fetch, XMLHttpRequest, WebSocket, EventSource, WebTransport and sendBeacon disabled; prompt text never sent; only the policy, settings and opt-in counts are stored; prompt text and placeholder maps are never saved.

**Say:** "Do not take my word for it. The browser enforces it: the CSP forbids connections, and the network panel is empty."

**Be precise if asked:** the saved policy, including custom rule terms you type, is kept in local storage. Prompt text is not.

### 8. Fault simulation (3:35 to 4:00)

**Click:** Settings, Testing, Failure drill, **Simulate failure**.

**Audience sees:** a result that says the fail-closed check held: every detector was forced to fail, the scan is reported as not completed, the decision is block, and the prompt is not treated as clean. Error codes are summarised once each.

**Say:** "Most tools fail open. When ours breaks, it blocks."

## Backup lines

- Anything slow or odd: "This is the fail-closed behaviour. A scan that cannot prove it is clean does not say it is clean."
- A finding you did not expect: "Deterministic detectors are authoritative; name suggestions are advisory."
- Asked about accuracy: "The regression corpus is synthetic tuning data. The only blind result is 94.2% precision and 90.7% recall on 40 cases, and it is not real-world evidence."
- Asked about the browser extension or ML model: "Not built; the core is framework-free so an extension can reuse it."
- Page looks wrong or the CSP meta tag is missing: you are on the dev server. Restart with `npm run build && npm run preview`.

## Reset between runs

Settings, Clear everything removes the saved policy (and the custom rules), settings and activity. Re-add the two rules in setup step 3 afterwards.
