import type { ReactElement } from 'react'
import { HistoryIcon } from '../shell/icons'

interface HistoryEmptyProps {
  enabled: boolean
}

/** Shown while there are no records. Calm copy and no placeholder numbers. */
export function HistoryEmpty({ enabled }: HistoryEmptyProps): ReactElement {
  return (
    <section className="card history-empty" aria-labelledby="history-empty-title">
      <span className="history-empty__icon">
        <HistoryIcon className="history-empty__svg" />
      </span>
      <h2 id="history-empty-title" tabIndex={-1} className="history-empty__title">
        {enabled ? 'No scans recorded yet' : 'Recording is off'}
      </h2>
      <p className="history-empty__text">
        {enabled
          ? 'Each scan adds a count here: its decision, its risk band and how many items were found. Prompt text is never kept.'
          : 'Nothing is recorded while Record activity is off. Turn it on to keep a count of each scan. Prompt text is never kept.'}
      </p>
    </section>
  )
}
