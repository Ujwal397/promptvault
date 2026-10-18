import { useRef, type ReactElement } from 'react'
import type { Notice } from './usePolicyScreen'

interface PolicyFooterProps {
  dirty: boolean
  importing: boolean
  notice: Notice | null
  onImportFile: (file: File) => void
  onExport: () => void
  onSave: () => void
  onDiscard: () => void
}

/** Import, export, and the unsaved-changes controls. The notice line is a live region for results. */
export function PolicyFooter({
  dirty,
  importing,
  notice,
  onImportFile,
  onExport,
  onSave,
  onDiscard,
}: PolicyFooterProps): ReactElement {
  const fileInput = useRef<HTMLInputElement>(null)
  return (
    <div className="policy-actions">
      <div className={notice ? 'policy-notices policy-notices--filled' : 'policy-notices'}>
        {notice && (
          // Keyed by its text, so a new message fades in and is announced again.
          <p
            key={notice.text}
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className={`policy-notice policy-notice--${notice.tone}`}
          >
            {notice.text}
          </p>
        )}
      </div>
      <footer className="policy-footer">
        <div className="policy-footer__group">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={importing}
            onClick={() => fileInput.current?.click()}
          >
            {importing && <span className="busy-dot" aria-hidden="true" />}
            {importing ? 'Checking signature…' : 'Import signed policy'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              // Clear the value so choosing the same file again still fires a change.
              event.currentTarget.value = ''
              if (file) onImportFile(file)
            }}
          />
          <button type="button" className="btn btn-ghost" onClick={onExport}>
            Export
          </button>
        </div>
        <div className="policy-footer__group">
          {dirty && <span className="policy-unsaved motion-rise">Unsaved changes</span>}
          {dirty && (
            // A fade only: a transform on a button would hold its hover lift.
            <button type="button" className="btn btn-ghost btn-compact motion-fade" onClick={onDiscard}>
              Discard
            </button>
          )}
          <button type="button" className="btn btn-primary" disabled={!dirty} onClick={onSave}>
            Save policy
          </button>
        </div>
      </footer>
    </div>
  )
}
