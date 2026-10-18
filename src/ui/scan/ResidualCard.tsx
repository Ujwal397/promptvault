import type { ReactElement } from 'react'
import type { ResidualRow } from './sanitizedCopy'

interface ResidualCardProps {
  rows: readonly ResidualRow[]
}

/** Shown only when the output is not ready: what the re-scan still finds, labelled and masked. */
export function ResidualCard({ rows }: ResidualCardProps): ReactElement {
  return (
    <section className="card residual-card" aria-labelledby="residual-title">
      <h2 id="residual-title" className="restore-title">
        Still in the output
      </h2>
      <p className="restore-lede">The re-scan still finds these. Use Back to change the selection.</p>
      {rows.length === 0 ? (
        <p className="restore-note">The re-scan did not complete, so these items could not be listed.</p>
      ) : (
        <ul className="residual-list">
          {rows.map((row) => (
            <li key={row.key} className="residual-row">
              <span className="residual-row__label">{row.label}</span>
              <code className="residual-row__value">{row.masked}</code>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
