import type { ReactElement } from 'react'
import { describeScan, type ScanState } from './scanState'

interface ScanStatusProps {
  state: ScanState
}

/** Live region under the button. It is always rendered so screen readers announce changes. */
export function ScanStatus({ state }: ScanStatusProps): ReactElement {
  const line = describeScan(state)
  const className = line ? `scan-status scan-status--${line.tone}` : 'scan-status'
  // The live region itself stays mounted so announcements still work. Only its text is keyed, so a new message fades in.
  return (
    <p role="status" className={className}>
      {line && (
        <span key={line.text} className="motion-fade">
          {line.text}
        </span>
      )}
    </p>
  )
}
