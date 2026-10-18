import { useMemo, type ReactElement } from 'react'
import type { Replacement } from '../../core'
import { segmentText, type HighlightRange } from './highlight'
import { tokenizeSanitized } from './redactionTokens'
import { styleRef } from '../components/styleRef'

interface SanitizedTextProps {
  sanitizedText: string
  replacements: readonly Replacement[]
}

/**
 * The sanitized output, with each placeholder drawn as a redaction bar. The copied text keeps `[TYPE_N]`.
 * The bars ink in left to right: each one's position in the text sets its delay (see sanitized.css).
 */
export function SanitizedText({ sanitizedText, replacements }: SanitizedTextProps): ReactElement {
  const tokens = useMemo(() => tokenizeSanitized(sanitizedText, replacements), [sanitizedText, replacements])
  return (
    <div className="sanitized-text motion-fade">
      {tokens.map((token, index) =>
        token.kind === 'text' ? (
          <span key={index}>{token.text}</span>
        ) : (
          <span key={index} className="redact-bar motion-ink" ref={styleRef({ '--i': index })}>
            {token.label}
          </span>
        ),
      )}
    </div>
  )
}

interface CompareTextProps {
  source: string
  replacements: readonly Replacement[]
}

/** The original prompt, with every replaced span marked. Offsets are the original ones. */
export function CompareText({ source, replacements }: CompareTextProps): ReactElement {
  const segments = useMemo(
    () =>
      segmentText(
        source,
        replacements.map((r): HighlightRange => ({ start: r.start, end: r.end, id: r.findingId, severity: 'high', selected: true })),
      ),
    [source, replacements],
  )
  return (
    <div className="sanitized-text motion-fade">
      {segments.map((segment, index) =>
        segment.ids.length === 0 ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <mark key={index} className="compare-mark">
            {segment.text}
          </mark>
        ),
      )}
    </div>
  )
}
