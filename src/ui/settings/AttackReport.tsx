import type { ReactElement } from 'react'
import type { AttackView } from './attackView'

/** A finished run: honesty labels, headline tiles and the per-category precision and recall. */
export function AttackReport({ view }: { view: AttackView }): ReactElement {
  return (
    <div className="set-results set-report motion-rise">
      <h4 className="set-report__title">{view.title}</h4>
      <ul className="set-notes">
        {view.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
      <dl className="set-tiles motion-stagger">
        {view.tiles.map((tile) => (
          <div key={tile.label} className="set-tile">
            <dt className="set-tile__label">{tile.label}</dt>
            <dd className="set-tile__value">{tile.value}</dd>
            <dd className="set-tile__hint">{tile.hint}</dd>
          </div>
        ))}
      </dl>
      {view.categories.length === 0 ? (
        <p className="set-note">No category was measured in this run.</p>
      ) : (
        <table className="set-table">
          <caption className="sr-only">Precision and recall by category</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Expected</th>
              <th scope="col">Precision</th>
              <th scope="col">Recall</th>
            </tr>
          </thead>
          <tbody>
            {view.categories.map((row) => (
              <tr key={row.category}>
                <th scope="row">{row.label}</th>
                <td>{row.expected}</td>
                <td>{row.precision}</td>
                <td>{row.recall}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
