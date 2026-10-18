import { useMemo, useState, useSyncExternalStore, type ReactElement, type ReactNode } from 'react'
import type { EventRecord } from '../../core'
import { createActivityStore } from './activityStore'
import { ActivityContext, type ActivityState } from './contexts'

export function ActivityProvider({ children }: { children: ReactNode }): ReactElement {
  const [store] = useState(createActivityStore)
  const snapshot = useSyncExternalStore(store.subscribe, store.get)

  const value = useMemo<ActivityState>(() => {
    const view = store.recorder()
    return {
      enabled: snapshot.enabled,
      retentionDays: snapshot.retentionDays,
      setEnabled: (enabled) => store.update((prev) => ({ ...prev, enabled })),
      setRetentionDays: (days) => store.update((prev) => ({ ...prev, retentionDays: days })),
      // export() is the recorder's validated, unexpired view of the store.
      records: JSON.parse(view.export()) as EventRecord[],
      summary: view.summary(),
      // Reads the live snapshot at call time, so a late scan respects a clear or opt-out that happened meanwhile.
      record: store.record,
      exportJson: () => store.recorder().export(),
      clear: () => store.update((prev) => ({ ...prev, records: [] })),
    }
  }, [snapshot, store])

  return <ActivityContext value={value}>{children}</ActivityContext>
}
