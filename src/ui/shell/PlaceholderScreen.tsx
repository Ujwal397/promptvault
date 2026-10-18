import type { ReactElement } from 'react'

interface PlaceholderScreenProps {
  title: string
}

/** Empty stand-in for a tab that has not been designed or built yet. */
export function PlaceholderScreen({ title }: PlaceholderScreenProps): ReactElement {
  return (
    <section className="placeholder">
      <h1 className="title-xl">{title}</h1>
    </section>
  )
}
