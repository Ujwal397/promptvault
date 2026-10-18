import { useState, type ReactElement } from 'react'
import { ArrowRightIcon } from '../shell/icons'
import { barLabel } from './redactionTokens'
import { restoreReply, restoreSummary, type PlaceholderRow, type RestoreResult } from './restoreReply'

interface RestoreCardProps {
  /** Only present for typed placeholders. Held in React state by the flow; never persisted or logged. */
  mapping: Readonly<Record<string, string>> | undefined
  rows: readonly PlaceholderRow[]
}

/**
 * "Got a reply?": pastes an AI reply back and swaps the real values in. The reply and the restored text
 * live only in this component's state, which is dropped when the step is left.
 */
export function RestoreCard({ mapping, rows }: RestoreCardProps): ReactElement {
  const [reply, setReply] = useState('')
  const [result, setResult] = useState<RestoreResult | null>(null)
  const canRestore = mapping !== undefined && reply.trim() !== ''

  const onRestore = () => {
    if (mapping !== undefined) setResult(restoreReply(reply, mapping))
  }

  return (
    <section className="card restore-card" aria-labelledby="restore-title">
      <div className="restore-head">
        <h2 id="restore-title" className="restore-title">
          Got a reply?
        </h2>
        <p className="restore-lede">Paste it back and we'll swap the real values in for you.</p>
      </div>

      {mapping === undefined ? (
        <p className="restore-note">
          Restoring needs typed placeholders. Choose typed placeholders in Settings, then sanitize again.
        </p>
      ) : (
        <>
          {rows.length === 0 ? (
            <p className="restore-note">No placeholders were issued for this prompt.</p>
          ) : (
            <ul className="placeholder-list">
              {rows.map((row) => (
                <li key={row.placeholder} className="placeholder-row">
                  <span className="redact-bar motion-ink">{barLabel(row.placeholder)}</span>
                  <span className="placeholder-row__label">{row.label}</span>
                </li>
              ))}
            </ul>
          )}

          <label htmlFor="reply-input" className="sr-only">
            AI reply
          </label>
          <textarea
            id="reply-input"
            className="reply-input"
            value={reply}
            spellCheck={false}
            placeholder="Paste the AI reply here"
            onChange={(event) => {
              setReply(event.target.value)
              setResult(null)
            }}
          />
          <div className="restore-actions">
            <button type="button" className="btn btn-ghost" disabled={!canRestore} onClick={onRestore}>
              Restore reply
              <ArrowRightIcon className="btn-icon" />
            </button>
          </div>

          {result && (
            <>
              <p role="status" className="restore-status">
                {restoreSummary(result)}
              </p>
              <div className="restore-output motion-rise">{result.text}</div>
            </>
          )}
        </>
      )}
    </section>
  )
}
