import { useMemo, useState, type ReactElement } from 'react'
import { useActivity } from '../state/contexts'
import { DecisionChart } from './DecisionChart'
import { HistoryEmpty } from './HistoryEmpty'
import { HistoryStatTiles } from './HistoryStatTiles'
import { RecentScansCard } from './RecentScansCard'
import { RecordToggle } from './RecordToggle'
import { TopCategories } from './TopCategories'
import { buildHistoryView } from './historyModel'
import './history.css'
import './history-chart.css'
import './history-lists.css'

/** History tab: opt-in activity counts (never prompt text), from the shared activity state. */
export function HistoryScreen(): ReactElement {
  const { records, summary, enabled, retentionDays, setEnabled } = useActivity()
  const hasRecords = records.length > 0
  // App remounts this screen on each visit, so the clock is read afresh and the 14-day window stays current.
  const [openedAt] = useState(() => new Date())
  const view = useMemo(
    () => buildHistoryView(records, summary.validationPassRate, openedAt),
    [records, summary.validationPassRate, openedAt],
  )

  return (
    <section className="history motion-stagger" aria-labelledby="history-title">
      <div className="history-head">
        <div className="history-intro">
          <h1 id="history-title" className="title-xl">
            History
          </h1>
          <p className="history-lede">Counts only. Your prompt text and the values found are never saved.</p>
        </div>
        <RecordToggle checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {!enabled && hasRecords && (
        <p className="history-note">Recording is off. Records already kept stay until they expire or you clear them.</p>
      )}

      {hasRecords ? (
        <>
          <HistoryStatTiles stats={view.stats} retentionDays={retentionDays} />
          <div className="history-row">
            <DecisionChart buckets={view.buckets} max={view.chartMax} />
            <TopCategories tallies={view.categories} />
          </div>
          <RecentScansCard rows={view.rows} totalScans={view.stats.scans} />
        </>
      ) : (
        <HistoryEmpty enabled={enabled} />
      )}
    </section>
  )
}
