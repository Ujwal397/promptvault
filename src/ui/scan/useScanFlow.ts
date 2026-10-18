import { useEffect, useReducer, useRef, useState } from 'react'
import { useScan } from '../hooks/useScan'
import { useActivity, usePolicy, useScanClient, useSetShellTint, useSettings } from '../state/contexts'
import { appendPrompt } from './promptFile'
import { runRedaction } from './runRedaction'
import { INITIAL_FLOW, scanFlowReducer, type FlowState, type ScanSnapshot } from './scanFlowState'
import type { ScanState } from './scanState'
import { SAMPLE_PROMPT } from './sampleText'
import { flowTint } from './tint'

export interface WriteFlowModel {
  text: string
  onTextChange: (text: string) => void
  onAppendText: (addition: string) => void
  scanState: ScanState
  onScan: () => void
}

export interface ScanFlowModel {
  flow: FlowState
  write: WriteFlowModel
  onToggle: (findingId: string) => void
  onEdit: () => void
  onRedact: () => void
  onBack: () => void
}

/**
 * Orchestrates Write, Review and Sanitized. Owns the editor text, the flow state, and the background tint.
 * A completed scan moves to Review. Failed and partial scans stay on Write with an honest message.
 */
export function useScanFlow(): ScanFlowModel {
  const getClient = useScanClient()
  const { policy } = usePolicy()
  const { placeholderMode } = useSettings()
  const activity = useActivity()
  const setTint = useSetShellTint()
  const { state: scanState, run, reset: resetScan } = useScan()
  const [text, setText] = useState(SAMPLE_PROMPT)
  const [flow, dispatch] = useReducer(scanFlowReducer, INITIAL_FLOW)
  // Bumped whenever in-flight work must be dropped: an edit, a policy change, or unmount.
  const session = useRef(0)

  useEffect(() => {
    setTint(flowTint(flow))
  }, [flow, setTint])

  // A different policy makes any open review or scan status out of date.
  useEffect(() => {
    resetScan()
    session.current += 1
    dispatch({ type: 'policy-changed', policy })
  }, [policy, resetScan])

  useEffect(() => {
    return () => {
      session.current += 1
    }
  }, [])

  const onScan = async () => {
    const scanned = text
    const scannedPolicy = policy
    const result = await run(scanned, scannedPolicy)
    if (result === null) return
    // Failed scans are not recorded: they did not check anything.
    if (result.status !== 'failed') activity.record(result, 'simulation')
    if (result.status === 'completed') {
      const snapshot: ScanSnapshot = { text: scanned, policy: scannedPolicy, result }
      dispatch({ type: 'scanned', snapshot })
    }
  }

  const onEdit = () => {
    session.current += 1
    resetScan()
    dispatch({ type: 'edit' })
  }

  const onRedact = async () => {
    if (flow.step !== 'review' || flow.review.busy) return
    const { review } = flow
    const token = session.current
    dispatch({ type: 'redact-start' })
    const outcome = await runRedaction(getClient(), {
      snapshot: review.snapshot,
      selected: review.selected,
      placeholderMode,
      newRequestId: () => crypto.randomUUID(),
    })
    if (token !== session.current) return
    dispatch(outcome.ok ? { type: 'sanitized', output: outcome.output } : { type: 'redact-failed', message: outcome.message })
  }

  return {
    flow,
    write: {
      text,
      onTextChange: (next) => {
        setText(next)
        resetScan()
      },
      onAppendText: (addition) => {
        setText((prev) => appendPrompt(prev, addition))
        resetScan()
      },
      scanState,
      onScan: () => void onScan(),
    },
    onToggle: (findingId) => dispatch({ type: 'toggle', findingId }),
    onEdit,
    onRedact: () => void onRedact(),
    onBack: () => dispatch({ type: 'back' }),
  }
}
