import type { ReactElement } from 'react'
import { ReviewScreen } from './ReviewScreen'
import { SanitizedScreen } from './SanitizedScreen'
import { useScanFlow } from './useScanFlow'
import { WriteScreen } from './WriteScreen'
import './review.css'
import './sanitized.css'

/** Scan tab: Write -> Review -> Sanitized. Only the completed-scan path moves forward. */
export function ScanFlow(): ReactElement {
  const model = useScanFlow()
  const { flow } = model

  if (flow.step === 'review') {
    return (
      <ReviewScreen review={flow.review} onToggle={model.onToggle} onEdit={model.onEdit} onRedact={model.onRedact} />
    )
  }
  if (flow.step === 'sanitized') {
    return <SanitizedScreen output={flow.output} onBack={model.onBack} />
  }
  return <WriteScreen {...model.write} />
}
