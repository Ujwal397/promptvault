/**
 * Privacy statements shown on the Settings screen. Each one is implemented and was checked in the code:
 * - CSP connect-src 'none': build/csp.ts (production builds only; dev mode needs a websocket for HMR).
 * - Worker network lockdown: src/adapters/web/lockdown.ts, loaded first by scan.worker.ts.
 * - Storage keys and what each holds: src/ui/state/storage.ts; activity record fields: src/core/events/record.ts.
 * Do not add a statement here unless it can be pointed at code or config.
 */
export interface PrivacyFact {
  title: string
  value: string
}

export const PRIVACY_FACTS: readonly PrivacyFact[] = [
  {
    title: 'Network connections',
    value: "Blocked by the Content Security Policy in production builds (connect-src 'none')",
  },
  {
    title: 'Where scanning runs',
    value: 'In a Web Worker, where fetch, XMLHttpRequest, WebSocket, EventSource, WebTransport and sendBeacon are disabled',
  },
  {
    title: 'Prompt text sent',
    value: 'Never. Scanning and redaction make no network requests',
  },
  {
    title: 'Stored in this browser',
    value:
      'Your saved policy (including custom rules you typed), your settings, and activity counts only if you turn recording on. Never prompt text',
  },
  {
    title: 'Prompt text and placeholder maps',
    value: 'Never saved. Any placeholder map lives in memory and is dropped when the page closes',
  },
]
