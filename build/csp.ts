import type { Plugin } from 'vite'

// Production builds ship a CSP that forbids ALL network connections from page scripts
// (connect-src 'none'). This is the browser-enforced backstop for the "no prompt egress" claim.
// Dev mode is excluded because Vite HMR needs a websocket.
export const CSP = [
  "default-src 'self'",
  "connect-src 'none'",
  "script-src 'self'",
  // React sets inline styles via CSSOM, which CSP does not restrict, so 'unsafe-inline' is unnecessary.
  "style-src 'self'",
  // The scan worker is created from a blob: URL so it INHERITS this policy (a URL-loaded worker would not).
  "worker-src 'self' blob:",
  "img-src 'self' data:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

export function cspPlugin(): Plugin {
  return {
    name: 'promptvault-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  }
}
