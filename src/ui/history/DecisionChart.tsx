import type { ReactElement } from 'react'
import { CHART_DAYS, DECISION_STACK, describeBucket, segmentPercent, type DayBucket } from './historyModel'
import { DECISION_LABELS, formatDay, formatDayNumber } from './labels'
import { styleRef } from '../components/styleRef'

interface DayColumnProps {
  bucket: DayBucket
  max: number
  /** Position in the chart, which sets when the bar starts to grow. */
  index: number
}

/** One day as a stack of decision segments. Empty decisions are not rendered, so an empty day is a zero-height bar. */
function DayColumn({ bucket, max, index }: DayColumnProps): ReactElement {
  return (
    <div className="history-day" title={`${formatDay(bucket.day)}: ${describeBucket(bucket)}`}>
      <div className="history-day__stack motion-grow-y" ref={styleRef({ '--i': index })}>
        {DECISION_STACK.map((decision) =>
          bucket.counts[decision] > 0 ? (
            <span
              key={decision}
              className={`history-seg history-seg--${decision}`}
              ref={styleRef({ height: `${segmentPercent(bucket.counts[decision], max)}%` })}
            />
          ) : null,
        )}
      </div>
    </div>
  )
}

interface DecisionChartProps {
  buckets: DayBucket[]
  max: number
}

/**
 * Scans per day, stacked by decision. The bars are decorative (aria-hidden); the visually hidden table
 * carries the same numbers for screen readers.
 */
export function DecisionChart({ buckets, max }: DecisionChartProps): ReactElement {
  const range =
    buckets.length > 0 ? `${formatDay(buckets[0].day)} – ${formatDay(buckets[buckets.length - 1].day)}` : null
  return (
    <section className="card history-panel history-chart-card" aria-labelledby="history-chart-title">
      <h2 id="history-chart-title" className="history-panel__title">
        Last {CHART_DAYS} days
      </h2>
      <div className="history-chart-plot" aria-hidden="true">
        {buckets.map((bucket, index) => (
          <DayColumn key={bucket.day} bucket={bucket} max={max} index={index} />
        ))}
      </div>
      <div className="history-chart-axis" aria-hidden="true">
        {buckets.map((bucket) => (
          <span key={bucket.day}>{formatDayNumber(bucket.day)}</span>
        ))}
      </div>
      {max === 0 && <p className="history-note">No scans in these {CHART_DAYS} days.</p>}

      {/* The wrapper clips the table. Without it, the table's nowrap cells widen the page on narrow screens. */}
      <div className="sr-only">
        <table>
          <caption>Scans per day for the last {CHART_DAYS} days, by decision (UTC)</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              {DECISION_STACK.map((decision) => (
                <th key={decision} scope="col">
                  {DECISION_LABELS[decision]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={bucket.day}>
                <th scope="row">{formatDay(bucket.day)}</th>
                {DECISION_STACK.map((decision) => (
                  <td key={decision}>{bucket.counts[decision]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="history-chart-foot">
        <ul className="history-legend">
          {DECISION_STACK.map((decision) => (
            <li key={decision} className="history-legend__item">
              <span className={`history-swatch history-seg--${decision}`} aria-hidden="true" />
              {DECISION_LABELS[decision]}
            </li>
          ))}
        </ul>
        {range && <span className="history-chart-range">{range}</span>}
      </div>
    </section>
  )
}
