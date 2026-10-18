import type { ReactElement } from 'react'
import { DrillResult } from './DrillResult'
import { SettingsItem } from './SettingsItem'
import { useFailureDrill } from './useFailureDrill'

export function FailureDrillPanel(): ReactElement {
  const drill = useFailureDrill()
  const busy = drill.state.phase === 'running'
  return (
    <SettingsItem
      title="Failure drill"
      description="Makes every detector fail on purpose, so you can see the scan block instead of passing silently. It does not record activity."
      control={
        <button
          type="button"
          className="btn set-btn-ghost"
          disabled={busy}
          aria-busy={busy}
          onClick={() => void drill.run()}
        >
          {busy && <span className="busy-dot" aria-hidden="true" />}
          {busy ? 'Running…' : 'Simulate failure'}
        </button>
      }
      footer={<DrillResult state={drill.state} />}
    />
  )
}
