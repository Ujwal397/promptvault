import { useCallback, useEffect, useRef, type ReactElement, type ReactNode } from 'react'
import { createLazyScanClient, type LazyScanClient } from '../../adapters/web/lazyScanClient'
import type { ScanClient } from '../../adapters/web/scanClient'
import { ScanClientContext } from './contexts'

/** Starts downloading the engine once the first paint is done, so the first scan doesn't wait for it. */
const PRELOAD_DELAY_MS = 300

/**
 * One worker-backed scan client for the whole app. It is created on first use and disposed on unmount.
 * Clearing the ref in cleanup means React StrictMode's simulated remount never reuses a disposed client.
 * The engine bundle is lazy: it loads in the background after first paint, or on the first call.
 */
export function ScanClientProvider({ children }: { children: ReactNode }): ReactElement {
  const clientRef = useRef<LazyScanClient | null>(null)

  const getClient = useCallback((): ScanClient => {
    if (clientRef.current === null) clientRef.current = createLazyScanClient()
    return clientRef.current
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => (getClient() as LazyScanClient).preload(), PRELOAD_DELAY_MS)
    return () => {
      clearTimeout(timer)
      clientRef.current?.dispose()
      clientRef.current = null
    }
  }, [getClient])

  return <ScanClientContext value={getClient}>{children}</ScanClientContext>
}
