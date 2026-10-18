import { useRef, type ChangeEvent, type ReactElement } from 'react'
import { AttachIcon } from '../shell/icons'

// Text formats only. The file is read locally with FileReader and never uploaded.
const ACCEPT = 'text/*,.md,.json,.csv,.log,.yaml,.yml,.env'

interface AttachButtonProps {
  onFile: (file: File) => void
}

/** Opens a local file picker and hands the chosen file to the parent. */
export function AttachButton({ onFile }: AttachButtonProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Clear the picker so choosing the same file again still fires a change.
    event.target.value = ''
    if (file) onFile(file)
  }

  return (
    <>
      <button
        type="button"
        className="icon-btn"
        aria-label="Attach file"
        onClick={() => inputRef.current?.click()}
      >
        <AttachIcon className="btn-icon" />
      </button>
      <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={handleChange} />
    </>
  )
}
