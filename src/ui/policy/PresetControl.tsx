import type { ReactElement } from 'react'
import type { PolicyPreset } from '../state/contexts'
import { PRESET_OPTIONS } from './draft'

interface PresetControlProps {
  preset: PolicyPreset
  onSelect: (preset: PolicyPreset) => void
}

/**
 * Strict / Permissive / Custom. The current preset is marked with aria-pressed. All three are always
 * available: Custom restores the custom draft you left, or starts one from the current rules.
 */
export function PresetControl({ preset, onSelect }: PresetControlProps): ReactElement {
  return (
    <div role="group" aria-label="Preset" className="preset-control">
      {PRESET_OPTIONS.map((option) => (
        <button
          key={option.preset}
          type="button"
          className="preset-control__btn"
          aria-pressed={option.preset === preset}
          onClick={() => onSelect(option.preset)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
