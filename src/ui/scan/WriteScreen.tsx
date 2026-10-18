import type { ReactElement } from 'react'
import { StepIndicator } from '../components/StepIndicator'
import { EditorFooter } from './EditorFooter'
import { ScanStatus } from './ScanStatus'
import { useWriteScreen, type WriteFlow } from './useWriteScreen'

/** Scan step 1 of 3: paste or attach a prompt, pick a policy, and scan it. */
export function WriteScreen(flow: WriteFlow): ReactElement {
  const model = useWriteScreen(flow)

  return (
    <section className="write-screen motion-stagger">
      <div className="write-intro">
        <StepIndicator current={1} total={3} />
        <h1 className="title-xl">Check before you send.</h1>
        <p className="write-lede">
          Paste your prompt. We'll find secrets and personal data so you can remove them first.
        </p>
      </div>

      <div className="card editor-card">
        <label htmlFor="prompt-input" className="sr-only">
          Prompt text
        </label>
        <textarea
          id="prompt-input"
          className="editor"
          value={model.text}
          spellCheck={false}
          onChange={(event) => model.onTextChange(event.target.value)}
        />
        {model.notice && (
          <p role="alert" className="editor-notice">
            {model.notice}
          </p>
        )}
        <EditorFooter
          preset={model.preset}
          onPresetChange={model.onPresetChange}
          onAttachFile={(file) => void model.onAttachFile(file)}
          charCount={model.text.length}
          overLimit={model.overLimit}
          canScan={model.canScan}
          scanning={model.scanState.status === 'scanning'}
          onScan={model.onScan}
        />
        <ScanStatus state={model.scanState} />
      </div>
    </section>
  )
}
