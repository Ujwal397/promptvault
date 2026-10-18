import type { ReactElement } from 'react'
import type { ScanResult } from '../../core'
import { riskSummary } from './riskSummary'
import { styleRef } from '../components/styleRef'

interface RiskLineProps {
  scan: ScanResult
}

/** One inline line: band and score, a thin meter, the top reason, and any policy block. Never a badge. */
export function RiskLine({ scan }: RiskLineProps): ReactElement {
  const summary = riskSummary(scan)
  const score = summary.score ?? 0
  return (
    <div className="risk-line">
      <span className="risk-line__head">
        <strong className={`risk-line__title risk-line__title--${summary.tone}`}>{summary.title}</strong>
        {summary.score !== null && <span className="risk-line__score">{summary.score}</span>}
      </span>
      {summary.score !== null && (
        <span
          role="meter"
          aria-label="Risk score"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={summary.score}
          className="risk-meter"
        >
          <span
            className={`risk-meter__fill risk-meter__fill--${summary.tone} motion-grow-x`}
            ref={styleRef({ width: `${score}%` })}
          />
        </span>
      )}
      {summary.reason && <span className="risk-line__reason">{summary.reason}</span>}
      {summary.blockNote && <span className="risk-line__block">{summary.blockNote}</span>}
    </div>
  )
}
