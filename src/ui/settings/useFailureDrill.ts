import { useCallback, useState } from 'react'
import type { ScanResult } from '../../core'
import { usePolicy, useScanClient } from '../state/contexts'
import { DRILL_SAMPLE } from './drill'

export type DrillState =
  | { phase: 'idle' }
  | { phase: 'running' }
  | { phase: 'done'; result: ScanResult; policyName: string }
  | { phase: 'error' }

export interface FailureDrill {
  state: DrillState
  run: () => Promise<void>
}

/**
 * Scans a synthetic sample with every detector forced to fail, under the current policy. The result is
 * shown as the scan client returned it. The drill never calls record(), so it leaves no activity.
 */
export function useFailureDrill(): FailureDrill {
  const getClient = useScanClient()
  const { policy } = usePolicy()
  const [state, setState] = useState<DrillState>({ phase: 'idle' })

  const run = useCallback(async () => {
    const policyName = policy.name
    setState({ phase: 'running' })
    try {
      const result = await getClient().scan({
        requestId: crypto.randomUUID(),
        text: DRILL_SAMPLE,
        policy,
        options: { faultInjection: { failDetectorId: '*' } },
      })
      setState({ phase: 'done', result, policyName })
    } catch {
      setState({ phase: 'error' })
    }
  }, [getClient, policy])

  return { state, run }
}
