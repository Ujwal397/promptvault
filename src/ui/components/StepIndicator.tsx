import type { ReactElement } from 'react'

interface StepIndicatorProps {
  current: number
  total: number
}

/** "Step N of M" with a bar per step. The bars are decorative; the text carries the meaning. */
export function StepIndicator({ current, total }: StepIndicatorProps): ReactElement {
  return (
    <div className="step">
      <span className="step__bars" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span key={index} className={index < current ? 'step__bar step__bar--on' : 'step__bar'} />
        ))}
      </span>
      <span>{`Step ${current} of ${total}`}</span>
    </div>
  )
}
