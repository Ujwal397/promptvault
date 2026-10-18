import { useState, type ReactElement } from 'react'
import type { PlaceholderMode } from '../../core'
import { usePolicy, useSettings } from '../state/contexts'
import { Segmented } from './Segmented'
import { SettingsItem } from './SettingsItem'
import { SettingsSection } from './SettingsSection'
import { ToggleSwitch } from './ToggleSwitch'
import { previewPlaceholder } from './placeholderPreview'

const STYLE_OPTIONS: readonly { value: PlaceholderMode; label: string }[] = [
  { value: 'typed', label: 'Labelled' },
  { value: 'mask', label: 'Mask' },
]

/** What the chosen style writes into the copied prompt, shown with a synthetic email. */
function PlaceholderExample({ mode }: { mode: PlaceholderMode }): ReactElement {
  const preview = previewPlaceholder(mode, 'EMAIL')
  return (
    <div className="set-preview">
      <span>Preview:</span>
      {/* Keyed by style, so switching style inks the bar in again. */}
      <span key={mode} className="set-ph motion-ink">
        {preview.bar}
      </span>
      <span>
        Copied as <span className="set-mono">{preview.copied}</span>
      </span>
    </div>
  )
}

/** Toggles policy.contextualAnalysis and keeps the current preset label, as the policy store requires. */
function SpotNamesItem(): ReactElement {
  const { policy, preset, applyPolicy } = usePolicy()
  const [error, setError] = useState<string | null>(null)

  const onChange = (next: boolean): void => {
    const result = applyPolicy({ ...policy, contextualAnalysis: next }, preset)
    setError(result.ok ? null : result.message)
  }

  return (
    <SettingsItem
      title="Spot names"
      tag="Suggestion"
      description="Uses on-device language analysis to suggest people's names. Suggestions are advisory: when the analyzer is unsure they can only warn, and they never override a pattern-based detector. A confident suggestion follows the name rule in your policy."
      details={
        error ? (
          <p role="alert" className="set-status set-status--danger">
            {error}
          </p>
        ) : null
      }
      control={<ToggleSwitch checked={policy.contextualAnalysis} onChange={onChange} label="Spot names" />}
    />
  )
}

export function RedactionSection(): ReactElement {
  const { placeholderMode, setPlaceholderMode } = useSettings()
  return (
    <SettingsSection id="redaction" title="Redaction" description="How removed values appear in the prompt you copy.">
      <SettingsItem
        title="Placeholder style"
        description="Labelled placeholders can be swapped back into the AI's reply. Masks can't."
        details={<PlaceholderExample mode={placeholderMode} />}
        control={
          <Segmented
            label="Placeholder style"
            options={STYLE_OPTIONS}
            value={placeholderMode}
            onChange={setPlaceholderMode}
          />
        }
      />
      <SpotNamesItem />
    </SettingsSection>
  )
}
