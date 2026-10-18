import { MAX_INPUT_CHARS } from '../../core'
import { Switch } from '../components/Switch'
import { ArrowRightIcon } from '../shell/icons'
import type { PolicyPreset } from '../state/contexts'
import { AttachButton } from './AttachButton'

interface EditorFooterProps {
  preset: PolicyPreset
  onPresetChange: (preset: Exclude<PolicyPreset, 'custom'>) => void
  onAttachFile: (file: File) => void
  charCount: number
  overLimit: boolean
  canScan: boolean
  scanning: boolean
  onScan: () => void
}

function countLabel(count: number, overLimit: boolean): string {
  const base = `${count.toLocaleString('en-US')} ${count === 1 ? 'character' : 'characters'}`
  return overLimit ? `${base}, over the ${MAX_INPUT_CHARS.toLocaleString('en-US')} limit` : base
}

/** Policy control, attach, character count and the primary "Scan prompt" button. */
export function EditorFooter({
  preset,
  onPresetChange,
  onAttachFile,
  charCount,
  overLimit,
  canScan,
  scanning,
  onScan,
}: EditorFooterProps) {
  return (
    <div className="editor-footer">
      <div className="editor-tools">
        {preset === 'custom' ? (
          // A custom policy comes from the Policy tab. It is shown, not switched, so it cannot be overwritten here by accident.
          <span className="switch switch--static">
            <span className="switch__option switch__option--on">Custom policy</span>
          </span>
        ) : (
          <Switch
            checked={preset === 'strict'}
            onCheckedChange={(strict) => onPresetChange(strict ? 'strict' : 'permissive')}
            ariaLabel="Strict mode"
            checkedText="Strict"
            uncheckedText="Permissive"
          />
        )}
        <AttachButton onFile={onAttachFile} />
        <span className={overLimit ? 'char-count char-count--over' : 'char-count'}>
          {countLabel(charCount, overLimit)}
        </span>
      </div>
      <button type="button" className="btn btn-primary scan-action" disabled={!canScan} onClick={onScan}>
        {scanning && <span className="busy-dot" aria-hidden="true" />}
        {scanning ? 'Scanning…' : 'Scan prompt'}
        {!scanning && <ArrowRightIcon className="btn-icon" />}
      </button>
    </div>
  )
}
