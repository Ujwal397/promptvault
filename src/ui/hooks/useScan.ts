import { useCallback, useRef, useState } from 'react'
import type { Policy, ScanResult } from '../../core'
import type { ScanState } from '../scan/scanState'
import { useScanClient } from '../state/contexts'

export interface ScanController {
  state: ScanState
  /**
   * Runs a scan. Resolves with the result when this request is still the latest one, or null when it
   * errored or was superseded by a newer request or a reset (for example an edit made during the scan).
   */
  run: (text: string, policy: Policy) => Promise<ScanResult | null>
  reset: () => void
}

/** Runs scans through the worker-backed client. Only the latest request's outcome is kept. */
export function useScan(): ScanController {
  const getClient = useScanClient()
  const [state, setState] = useState<ScanState>({ status: 'idle' })
  const latestRequestId = useRef<string | null>(null)

  const run = useCallback(
    async (text: string, policy: Policy): Promise<ScanResult | null> => {
      const requestId = crypto.randomUUID()
      latestRequestId.current = requestId
      setState({ status: 'scanning' })
      try {
        const result = await getClient().scan({ requestId, text, policy })
        if (latestRequestId.current !== requestId) return null
        setState({ status: 'done', result })
        return result
      } catch {
        if (latestRequestId.current === requestId) setState({ status: 'error' })
        return null
      }
    },
    [getClient],
  )

  const reset = useCallback(() => {
    latestRequestId.current = null
    setState((prev) => (prev.status === 'idle' ? prev : { status: 'idle' }))
  }, [])

  return { state, run, reset }
}
