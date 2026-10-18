import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useActivity } from '../state/contexts'
import { downloadJson, historyFileName } from './exportFile'
import { formatCount } from './labels'

/** After a clear, the empty state replaces this card. Move focus there so keyboard users are not dropped on the page body. */
function focusEmptyState(): void {
  window.requestAnimationFrame(() => document.getElementById('history-empty-title')?.focus())
}

/** Export and Clear. Clear asks for a second step inside the card, because it cannot be undone. */
export function HistoryActions(): ReactElement {
  const { exportJson, clear, summary } = useActivity()
  const [confirming, setConfirming] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Put focus on the safe choice when the confirmation opens.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus()
  }, [confirming])

  if (confirming) {
    return (
      <div className="history-confirm motion-fade" role="group" aria-label="Confirm clear history">
        <p className="history-confirm__text">
          Clear all {formatCount(summary.total)} records? This can't be undone.
        </p>
        <div className="history-actions">
          <button ref={cancelRef} type="button" className="history-btn" onClick={() => setConfirming(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="history-btn history-btn--danger-solid"
            onClick={() => {
              clear()
              focusEmptyState()
            }}
          >
            Clear history
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="history-actions">
      <button
        type="button"
        className="history-btn"
        onClick={() => downloadJson(exportJson(), historyFileName(new Date()))}
      >
        Export
      </button>
      <button type="button" className="history-btn history-btn--danger" onClick={() => setConfirming(true)}>
        Clear history
      </button>
    </div>
  )
}
