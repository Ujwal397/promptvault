import type { ReactElement, ReactNode } from 'react'

interface SettingsItemProps {
  title: string
  /** Makes the title a label for the control with this id, such as a select. */
  labelFor?: string
  /** Short status word next to the title, such as "Suggestion". */
  tag?: string
  description?: string
  /** Extra content under the description, in the left column (for example a preview). */
  details?: ReactNode
  control?: ReactNode
  /** Full-width content under the row (for example results). */
  footer?: ReactNode
}

/** One row of a settings card: title and description on the left, the control on the right. */
export function SettingsItem({
  title,
  labelFor,
  tag,
  description,
  details,
  control,
  footer,
}: SettingsItemProps): ReactElement {
  return (
    <div className="set-item">
      <div className="set-item__text">
        <div className="set-item__heading">
          {labelFor ? (
            <label htmlFor={labelFor} className="set-item__title">
              {title}
            </label>
          ) : (
            <h3 className="set-item__title">{title}</h3>
          )}
          {tag && <span className="set-tag">{tag}</span>}
        </div>
        {description && <p className="set-item__desc">{description}</p>}
        {details}
      </div>
      {control && <div className="set-item__control">{control}</div>}
      {footer && <div className="set-item__footer">{footer}</div>}
    </div>
  )
}
