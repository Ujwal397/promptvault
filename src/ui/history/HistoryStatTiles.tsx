import type { ReactElement } from 'react'
import type { HistoryStats } from './historyModel'
import { formatCount, formatRate } from './labels'

type Tone = 'ember' | 'sage'

interface StatTileProps {
  label: string
  value: string
  note?: string
  tone?: Tone
}

function StatTile({ label, value, note, tone }: StatTileProps): ReactElement {
  const valueClass = tone
    ? `history-stat__value history-text--${tone} motion-rise`
    : 'history-stat__value motion-rise'
  return (
    <div className="history-stat">
      <dt className="history-stat__label">{label}</dt>
      <dd className={valueClass}>{value}</dd>
      {note && <dd className="history-stat__note">{note}</dd>}
    </div>
  )
}

/** Sage only when every validated record passed. Ember when residuals were found. Neutral when unknown. */
function rescanTone(rate: number | null): Tone | undefined {
  if (rate === null) return undefined
  return rate >= 1 ? 'sage' : 'ember'
}

interface HistoryStatTilesProps {
  stats: HistoryStats
  retentionDays: number
}

export function HistoryStatTiles({ stats, retentionDays }: HistoryStatTilesProps): ReactElement {
  return (
    <>
      <dl className="card history-stats">
        <StatTile
          label="Scans"
          value={formatCount(stats.scans)}
          note={stats.copied > 0 ? `${formatCount(stats.copied)} copied to send` : undefined}
        />
        <StatTile label="Items caught" value={formatCount(stats.itemsCaught)} />
        <StatTile
          label="Blocked"
          value={formatCount(stats.blocked)}
          tone={stats.blocked > 0 ? 'ember' : undefined}
        />
        <StatTile
          label="Re-scan passed"
          value={formatRate(stats.rescanPassRate)}
          tone={rescanTone(stats.rescanPassRate)}
        />
      </dl>
      <p className="history-note">Records are kept for {retentionDays} days, then dropped.</p>
    </>
  )
}
