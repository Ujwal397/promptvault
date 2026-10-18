/**
 * Defence in depth for the scan worker: remove every network-capable API from the worker global.
 * The primary control is the CSP (the worker is a blob: worker and so inherits the document CSP);
 * this module makes sure the scan code cannot reach the network even if that control is bypassed.
 * It must be the FIRST import of the worker entry so it runs before any other module is evaluated.
 */

const BLOCKED_GLOBALS = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'importScripts',
  'WebTransport',
] as const

function blockedStub(name: string): () => never {
  return function blocked(): never {
    throw new Error(`${name} is disabled in the scan worker.`)
  }
}

function lock(target: object, name: string, value: unknown): void {
  try {
    Object.defineProperty(target, name, { value, writable: false, configurable: false, enumerable: false })
  } catch {
    // Non-configurable on this engine: fall back to plain assignment so the stub still replaces it.
    try {
      ;(target as Record<string, unknown>)[name] = value
    } catch {
      /* nothing more can be done */
    }
  }
}

export function applyLockdown(target: object): void {
  for (const name of BLOCKED_GLOBALS) {
    if (name in target) lock(target, name, blockedStub(name))
  }
  const nav = (target as { navigator?: object }).navigator
  if (nav && 'sendBeacon' in nav) lock(nav, 'sendBeacon', blockedStub('sendBeacon'))
}

applyLockdown(globalThis)
