import type { ReactElement, ReactNode } from 'react'

interface SettingsSectionProps {
  /** Unique within the screen; used to link the heading to the section. */
  id: string
  title: string
  description: string
  children: ReactNode
}

/** A titled group on the left and a card of rows on the right (stacked on narrow screens). */
export function SettingsSection({ id, title, description, children }: SettingsSectionProps): ReactElement {
  const headingId = `set-${id}-title`
  return (
    <section className="set-section" aria-labelledby={headingId}>
      <div className="set-section__head">
        <h2 id={headingId} className="set-section__title">
          {title}
        </h2>
        <p className="set-section__desc">{description}</p>
      </div>
      <div className="card set-card">{children}</div>
    </section>
  )
}
