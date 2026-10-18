import { useState } from 'react'
import { MAX_INPUT_CHARS } from '../../core'
import { usePolicy, presetPolicy, type PolicyPreset } from '../state/contexts'
import { readPromptFile } from './promptFile'
import type { ScanState } from './scanState'

/** What the Write screen needs from the flow. The flow owns the text and the scan. */
export interface WriteFlow {
  text: string
  onTextChange: (text: string) => void
  onAppendText: (addition: string) => void
  scanState: ScanState
  onScan: () => void
}

export interface WriteScreenModel {
  text: string
  preset: PolicyPreset
  notice: string | null
  overLimit: boolean
  canScan: boolean
  scanState: ScanState
  onTextChange: (text: string) => void
  onPresetChange: (preset: Exclude<PolicyPreset, 'custom'>) => void
  onAttachFile: (file: File) => Promise<void>
  onScan: () => void
}

/** Write-screen state: the policy switch (through the shared policy), attachments and the scan button. */
export function useWriteScreen(flow: WriteFlow): WriteScreenModel {
  const { preset, applyPolicy } = usePolicy()
  const [notice, setNotice] = useState<string | null>(null)

  const overLimit = flow.text.length > MAX_INPUT_CHARS
  const canScan = flow.text.trim().length > 0 && !overLimit && flow.scanState.status !== 'scanning'

  return {
    text: flow.text,
    preset,
    notice,
    overLimit,
    canScan,
    scanState: flow.scanState,
    onTextChange: (next) => {
      setNotice(null)
      flow.onTextChange(next)
    },
    onPresetChange: (next) => {
      const result = applyPolicy(presetPolicy(next), next)
      setNotice(result.ok ? null : result.message)
    },
    onAttachFile: async (file) => {
      try {
        const fileText = await readPromptFile(file)
        setNotice(null)
        flow.onAppendText(fileText)
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'That file could not be read.')
      }
    },
    onScan: flow.onScan,
  }
}
