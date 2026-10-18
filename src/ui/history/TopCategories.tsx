import type { ReactElement } from 'react'
import type { CategoryTally } from './historyModel'
import { CATEGORY_LABELS, formatCount } from './labels'
import { styleRef } from '../components/styleRef'

interface TopCategoriesProps {
  tallies: CategoryTally[]
}

/** Most-caught categories as labelled bars. Each bar is relative to the largest count; the number carries the value. */
export function TopCategories({ tallies }: TopCategoriesProps): ReactElement {
  return (
    <section className="card history-panel history-cats-card" aria-labelledby="history-cats-title">
      <h2 id="history-cats-title" className="history-panel__title">
        Most caught
      </h2>
      {tallies.length === 0 ? (
        <p className="history-note">No items caught yet.</p>
      ) : (
        <ul className="history-cats">
          {tallies.map((tally, index) => (
            <li key={tally.category} className="history-cat">
              <div className="history-cat__row">
                <span>{CATEGORY_LABELS[tally.category]}</span>
                <span className="history-cat__count">{formatCount(tally.count)}</span>
              </div>
              <div className="history-cat__track" aria-hidden="true">
                <div
                  className="history-cat__fill motion-grow-x"
                  ref={styleRef({ width: `${tally.share * 100}%`, '--i': index })}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
