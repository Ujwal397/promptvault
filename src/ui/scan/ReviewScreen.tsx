import { useEffect, useMemo, useRef, type ReactElement } from 'react'
import { StepIndicator } from '../components/StepIndicator'
import { ArrowRightIcon } from '../shell/icons'
import { ArrowLeftIcon } from './flowIcons'
import { FindingsPanel } from './FindingsPanel'
import { PromptHighlight } from './PromptHighlight'
import type { ReviewState } from './scanFlowState'
import { RiskLine } from './RiskLine'
import { countNeedingAttention, decisionMap, idsToRedact } from './selection'

interface ReviewScreenProps {
  review: ReviewState
  onToggle: (findingId: string) => void
  onEdit: () => void
  onRedact: () => void
}

function attentionHeadline(count: number): string {
  if (count === 0) return 'Nothing needs your attention.'
  return count === 1 ? '1 item needs your attention.' : `${count} items need your attention.`
}

function redactLabel(count: number): string {
  if (count === 0) return 'Continue without redacting'
  return count === 1 ? 'Redact 1 item' : `Redact ${count} items`
}

/** Scan step 2 of 3: what the policy flagged, what will be removed, and the choice to edit or redact. */
export function ReviewScreen({ review, onToggle, onEdit, onRedact }: ReviewScreenProps): ReactElement {
  const { snapshot, selected, busy, error } = review
  const { text, result } = snapshot
  const headingRef = useRef<HTMLHeadingElement>(null)
  const decisions = useMemo(() => decisionMap(result.findingDecisions), [result])
  const attention = countNeedingAttention(result.findings, decisions)
  const redactCount = idsToRedact(result.findings, decisions, selected).length

  // Move focus to the new step's heading. The heading is not a tab stop, so no focus ring is drawn for it.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <section className="review-screen motion-stagger">
      <div className="review-intro">
        <StepIndicator current={2} total={3} />
        <h1 ref={headingRef} tabIndex={-1} className="title-xl step-heading">
          {attentionHeadline(attention)}
        </h1>
        <RiskLine scan={result} />
      </div>

      <div className="review-columns">
        <PromptHighlight text={text} findings={result.findings} decisions={decisions} selected={selected} />
        <FindingsPanel
          text={text}
          findings={result.findings}
          decisions={decisions}
          selected={selected}
          disabled={busy}
          onToggle={onToggle}
        />
      </div>

      {error && (
        <p role="alert" className="review-error">
          {error}
        </p>
      )}

      <div className="review-actions">
        <button type="button" className="btn btn-ghost" onClick={onEdit} disabled={busy}>
          <ArrowLeftIcon className="btn-icon" />
          Edit prompt
        </button>
        <button type="button" className="btn btn-primary" onClick={onRedact} disabled={busy}>
          {busy && <span className="busy-dot" aria-hidden="true" />}
          {/* Keyed by its text, so the count fades to its new value as findings are ticked. */}
          <span key={busy ? 'busy' : redactCount} className="motion-fade">
            {busy ? 'Redacting…' : redactLabel(redactCount)}
          </span>
          {!busy && <ArrowRightIcon className="btn-icon" />}
        </button>
      </div>
    </section>
  )
}
