import type { ReactElement } from 'react'
import { CORPUS_NOTES, CORPUS_OPTIONS } from './attackView'
import { AttackResults } from './AttackResults'
import { Segmented } from './Segmented'
import { SettingsItem } from './SettingsItem'
import { useAttackSuite } from './useAttackSuite'

export function AttackSuitePanel(): ReactElement {
  const suite = useAttackSuite()
  const busy = suite.run.phase === 'running'
  return (
    <SettingsItem
      title="Attack test suite"
      description="Runs a set of disguised and obfuscated secrets through your current policy and reports what was caught."
      details={suite.run.phase === 'done' ? null : <p className="set-note">{CORPUS_NOTES[suite.corpus]}</p>}
      control={
        <div className="set-actions">
          <Segmented
            label="Corpus"
            options={CORPUS_OPTIONS}
            value={suite.corpus}
            onChange={suite.select}
            disabled={busy}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void suite.start()}
          >
            {busy && <span className="busy-dot" aria-hidden="true" />}
            {busy ? 'Running…' : 'Run suite'}
          </button>
        </div>
      }
      footer={<AttackResults run={suite.run} />}
    />
  )
}
