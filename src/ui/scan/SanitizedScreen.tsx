import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { StepIndicator } from '../components/StepIndicator'
import { useActivity } from '../state/contexts'
import { copyText } from './clipboard'
import { ArrowLeftIcon, CopyIcon } from './flowIcons'
import { CompareText, SanitizedText } from './OutputText'
import { placeholderRows } from './restoreReply'
import { ResidualCard } from './ResidualCard'
import { RestoreCard } from './RestoreCard'
import { sanitizedVerdict } from './readiness'
import type { SanitizedOutput } from './scanFlowState'
import { copyMessage, residualRows, statusCopy, type CopyState } from './sanitizedCopy'

type View = 'sanitized' | 'compare'

const VIEWS: readonly { id: View; label: string }[] = [
  { id: 'sanitized', label: 'Sanitized' },
  { id: 'compare', label: 'Compare' },
]

interface SanitizedScreenProps {
  output: SanitizedOutput
  onBack: () => void
}

/** Scan step 3 of 3: the redacted prompt, whether it is ready to send, copy, and restoring a reply. */
export function SanitizedScreen({ output, onBack }: SanitizedScreenProps): ReactElement {
  const { source, scan, result, kept } = output
  // One verdict drives the headline, the tint and the Copy state, so they cannot disagree.
  const verdict = sanitizedVerdict(result, kept)
  const { readiness } = verdict
  const activity = useActivity()
  const [view, setView] = useState<View>('sanitized')
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const sanitizedText = result.sanitizedText ?? ''
  const rows = useMemo(
    () => placeholderRows(result.mapping ?? {}, result.replacements, scan.findings),
    [result.mapping, result.replacements, scan.findings],
  )
  const status = statusCopy(result, readiness)
  const message = copyMessage(copyState, readiness)

  // Move focus to the new step's heading. The heading is not a tab stop, so no focus ring is drawn for it.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const onCopy = async () => {
    if (!readiness.ready) return
    const copied = await copyText(sanitizedText)
    setCopyState(copied ? 'copied' : 'failed')
    // Count the submission only once the text is actually on the clipboard.
    if (copied) activity.record(scan, 'submission', result)
  }

  return (
    <section className="sanitized-screen motion-stagger">
      <div className="sanitized-intro">
        <StepIndicator current={3} total={3} />
        <h1 ref={headingRef} tabIndex={-1} className="title-xl step-heading">
          {verdict.headline}
        </h1>
        <p className={`status-line status-line--${status.tone}`}>
          <strong className="status-line__lead">{status.lead}</strong>
          <span className="status-line__sep" aria-hidden="true" />
          <span>{status.rest}</span>
        </p>
      </div>

      <section className="card sanitized-card" aria-label="Sanitized prompt">
        {view === 'sanitized' ? (
          <SanitizedText sanitizedText={sanitizedText} replacements={result.replacements} />
        ) : (
          <CompareText source={source} replacements={result.replacements} />
        )}
        <div className="sanitized-toolbar">
          <div role="group" aria-label="View" className="seg-group">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="seg"
                aria-pressed={view === item.id}
                onClick={() => setView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="sanitized-buttons">
            <button type="button" className="btn btn-ghost" onClick={onBack}>
              <ArrowLeftIcon className="btn-icon" />
              Back
            </button>
            <button type="button" className="btn btn-primary" disabled={!readiness.ready} onClick={() => void onCopy()}>
              <CopyIcon className="btn-icon" />
              {/* Keyed by its text, so "Copied" fades in over "Copy prompt". */}
              <span key={copyState === 'copied' ? 'copied' : 'copy'} className="motion-fade">
                {copyState === 'copied' ? 'Copied' : 'Copy prompt'}
              </span>
            </button>
          </div>
        </div>
        <p role="status" className={copyState === 'failed' ? 'copy-status copy-status--danger' : 'copy-status'}>
          {message && (
            <span key={copyState} className="motion-fade">
              {message}
            </span>
          )}
        </p>
      </section>

      {result.residualRiskNotes.length > 0 && (
        <ul className="sanitized-notes" aria-label="Notes about this output">
          {result.residualRiskNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      {!readiness.ready && <ResidualCard rows={residualRows(result)} />}
      <RestoreCard mapping={result.mapping} rows={rows} />
    </section>
  )
}
