import type { ReactElement } from 'react'
import type { RiskBand } from '../../core'
import { HistoryActions } from './HistoryActions'
import type { ScanRow } from './historyModel'
import { DECISION_LABELS, EMPTY_VALUE, RISK_LABELS, formatCount, formatDay, rescanLabel } from './labels'

/** Risk colour: ember for high and critical, ochre for medium, muted for the rest and for unknown. */
function riskTone(band: RiskBand | null): string {
  if (band === 'high' || band === 'critical') return 'history-text--ember'
  if (band === 'medium') return 'history-text--ochre'
  return 'history-text--muted'
}

function rescanTone(passed: boolean | null): string {
  if (passed === null) return 'history-text--muted'
  return passed ? 'history-text--sage' : 'history-text--ember'
}

function ScanTableRow({ row }: { row: ScanRow }): ReactElement {
  return (
    <tr>
      <td className="history-text--muted">{formatDay(row.day)}</td>
      <td>
        <span className={`history-tag history-tag--${row.decision}`}>{DECISION_LABELS[row.decision]}</span>
      </td>
      <td className={riskTone(row.riskBand)}>{row.riskBand ? RISK_LABELS[row.riskBand] : EMPTY_VALUE}</td>
      <td>{formatCount(row.findingCount)}</td>
      <td className={rescanTone(row.validationPassed)}>{rescanLabel(row.validationPassed)}</td>
    </tr>
  )
}

interface RecentScansCardProps {
  rows: ScanRow[]
  totalScans: number
}

/** The newest scans as a table, with Export and Clear. Stored records carry a day only, so there are no times. */
export function RecentScansCard({ rows, totalScans }: RecentScansCardProps): ReactElement {
  return (
    <section className="card history-panel history-table-card" aria-labelledby="history-recent-title">
      <div className="history-table-head">
        <h2 id="history-recent-title" className="history-panel__title">
          Recent scans
        </h2>
        <HistoryActions />
      </div>
      <div className="history-table-scroll">
        <table className="history-table" aria-labelledby="history-recent-title">
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Outcome</th>
              <th scope="col">Risk</th>
              <th scope="col">Items</th>
              <th scope="col">Re-scan</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="history-text--muted">
                  No scans recorded yet.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => <ScanTableRow key={index} row={row} />)
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && (
        <p className="history-note">
          Showing the latest {rows.length} of {formatCount(totalScans)} scans.
        </p>
      )}
    </section>
  )
}
