import { useMemo, type ReactElement } from 'react'
import type { Finding, Severity } from '../../core'
import { segmentText, type TextSegment } from './highlight'
import { isChecked, type DecisionMap } from './selection'

interface PromptHighlightProps {
  text: string
  findings: readonly Finding[]
  decisions: DecisionMap
  selected: ReadonlySet<string>
}

const TONE: Record<Severity, string> = { critical: 'high', high: 'high', medium: 'medium', low: 'low' }

function classFor(segment: TextSegment): string {
  const tone = segment.severity === null ? 'low' : TONE[segment.severity]
  return segment.selected ? `hi hi--${tone}` : `hi hi--${tone} hi--kept`
}

/** Left column: the prompt with each finding highlighted in place. Unticked findings are drawn dotted. */
export function PromptHighlight({ text, findings, decisions, selected }: PromptHighlightProps): ReactElement {
  const segments = useMemo(
    () =>
      segmentText(
        text,
        findings.map((f) => ({
          start: f.startOffset,
          end: f.endOffset,
          id: f.findingId,
          severity: f.severity,
          selected: isChecked(f.findingId, decisions, selected),
        })),
      ),
    [text, findings, decisions, selected],
  )

  return (
    <section className="card review-prompt-card" aria-labelledby="review-prompt-title">
      <h2 id="review-prompt-title" className="review-card-title">
        Your prompt
      </h2>
      <div className="review-prompt">
        {segments.map((segment, index) =>
          segment.severity === null ? (
            segment.text
          ) : (
            <span key={index} className={classFor(segment)}>
              {segment.text}
            </span>
          ),
        )}
      </div>
    </section>
  )
}
